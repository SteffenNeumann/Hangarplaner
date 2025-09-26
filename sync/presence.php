<?php
/**
 * Presence endpoint for HangarPlanner
 * - POST: Heartbeat/Leave to record active sessions
 * - GET: List active users within TTL window
 *
 * This is intentionally separate from sync/data.php to avoid X-Sync-Role write gating.
 */

// Basic CORS and content headers (mirror data.php for dev parity)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Sync-Role");
header("Content-Type: application/json; charset=UTF-8");

$LOG_FILE = __DIR__ . '/presence_log.txt';
function presence_log($msg) {
    global $LOG_FILE;
    $ts = date('c');
    @file_put_contents($LOG_FILE, "[$ts] $msg\n", FILE_APPEND);
}

// OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    presence_log("OPTIONS preflight: URI=" . ($_SERVER['REQUEST_URI'] ?? '-') . " IP=" . ($_SERVER['REMOTE_ADDR'] ?? '-'));
    http_response_code(200);
    exit;
}

$presenceFile = __DIR__ . '/presence.json';
$TTL_SECONDS = 90; // consider session online if seen within last 90 seconds

// Utility: read presence list safely
function read_presence($file) {
    if (!file_exists($file)) return [];
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return (is_array($data) && isset($data['users']) && is_array($data['users'])) ? $data['users'] : [];
}

// Utility: write presence list safely
function write_presence($file, $users) {
    $payload = json_encode(['users' => array_values($users)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($payload === false) $payload = '{"users":[]}';
    // Ensure directory exists and is writable
    $dir = dirname($file);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0777, true)) {
            presence_log("ERROR mkdir failed for " . $dir . " err=" . json_encode(error_get_last()));
            return false;
        }
    }
    $ok = @file_put_contents($file, $payload, LOCK_EX);
    if ($ok === false) {
        presence_log("ERROR write_presence failed for file=" . $file . " err=" . json_encode(error_get_last()));
        return false;
    }
    @chmod($file, 0664);
    return true;
}

// Cleanup expired sessions
function cleanup_expired($users, $ttlSeconds) {
    $now = time();
    $out = [];
    foreach ($users as $u) {
        $last = isset($u['lastSeen']) ? intval($u['lastSeen']) : 0;
        if ($last >= ($now - $ttlSeconds)) {
            $out[] = $u;
        }
    }
    return $out;
}

// Atomic read-modify-write with file lock to avoid overwrite races
function update_presence_atomic($file, $ttlSeconds, $mutator, $reqId = '') {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0777, true)) {
            presence_log("$reqId ERROR mkdir failed for " . $dir . " err=" . json_encode(error_get_last()));
            return false;
        }
    }
    $fp = @fopen($file, 'c+'); // create if not exists, read/write
    if (!$fp) {
        presence_log("$reqId ERROR fopen failed for file=" . $file . " err=" . json_encode(error_get_last()));
        return false;
    }
    try {
        if (!@flock($fp, LOCK_EX)) {
            presence_log("$reqId ERROR flock LOCK_EX failed for file=" . $file);
            @fclose($fp);
            return false;
        }
        // Read current content under lock
        @rewind($fp);
        $raw = '';
        while (!feof($fp)) {
            $chunk = fread($fp, 8192);
            if ($chunk === false) break;
            $raw .= $chunk;
        }
        $data = json_decode($raw, true);
        $users = (is_array($data) && isset($data['users']) && is_array($data['users'])) ? $data['users'] : [];
        $before = count($users);
        $users = cleanup_expired($users, $ttlSeconds);
        // Use associative map keyed by sessionId to avoid duplicates and ease merge
        $map = [];
        foreach ($users as $u) { if (isset($u['sessionId'])) { $map[$u['sessionId']] = $u; } }
        // Apply mutator; it should modify $map by reference
        $mutator($map);
        // Rebuild users array
        $users = array_values($map);
        // Write back
        $payload = json_encode(['users' => $users], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($payload === false) $payload = '{"users":[]}';
        @ftruncate($fp, 0);
        @rewind($fp);
        $wrote = @fwrite($fp, $payload);
        @fflush($fp);
        @flock($fp, LOCK_UN);
        @fclose($fp);
        if ($wrote === false) {
            presence_log("$reqId ERROR fwrite failed for file=" . $file . " err=" . json_encode(error_get_last()));
            return false;
        }
        @chmod($file, 0664);
        presence_log("$reqId ATOMIC update users_before=$before users_after=" . count($users));
        return $users;
    } catch (Throwable $t) {
        @flock($fp, LOCK_UN);
        @fclose($fp);
        presence_log("$reqId EXCEPTION atomic update: " . $t->getMessage());
        return false;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$reqId = bin2hex(random_bytes(4));
presence_log("$reqId BEGIN method=" . $method . " uri=" . ($_SERVER['REQUEST_URI'] ?? '-') . " ip=" . ($_SERVER['REMOTE_ADDR'] ?? '-'));

if ($method === 'POST') {
    try {
        $raw = @file_get_contents('php://input');
        presence_log("$reqId POST raw_len=" . strlen((string)$raw) . " ct=" . ($_SERVER['CONTENT_TYPE'] ?? '-'));
        if (!$raw) throw new Exception('Empty request body');
        $body = json_decode($raw, true);
        if (!is_array($body)) throw new Exception('Invalid JSON body');

        $action = isset($body['action']) ? strtolower(trim($body['action'])) : 'heartbeat';
        $sessionId = isset($body['sessionId']) ? trim($body['sessionId']) : '';
        if ($sessionId === '') throw new Exception('Missing sessionId');

        // Determine displayName: prefer body, then web server auth, fallback to short session id
        $displayName = isset($body['displayName']) ? trim($body['displayName']) : '';
        if ($displayName === '') {
            if (!empty($_SERVER['REMOTE_USER'])) $displayName = $_SERVER['REMOTE_USER'];
            else if (!empty($_SERVER['PHP_AUTH_USER'])) $displayName = $_SERVER['PHP_AUTH_USER'];
            else $displayName = substr($sessionId, 0, 8);
        }

        $role = isset($body['role']) ? strtolower(trim($body['role'])) : 'standalone'; // master|sync|standalone
        if (!in_array($role, ['master','sync','standalone'])) $role = 'standalone';
        $page = isset($body['page']) ? substr(trim($body['page']), 0, 120) : '';
        // Optional per-field locks: { fieldId: untilTsMs }
        $locks = [];
        if (isset($body['locks']) && is_array($body['locks'])) {
            foreach ($body['locks'] as $k => $v) {
                $fid = is_string($k) ? trim($k) : '';
                if ($fid === '') continue;
                $until = is_numeric($v) ? intval($v) : 0;
                if ($until > 0) { $locks[$fid] = $until; }
            }
        }

        // Atomic update to avoid overwrite races
        $now = time();
        $users = update_presence_atomic($presenceFile, $TTL_SECONDS, function (&$map) use ($action, $sessionId, $displayName, $role, $page, $locks, $now, $reqId) {
            if ($action === 'leave') {
                if (isset($map[$sessionId])) unset($map[$sessionId]);
                presence_log("$reqId LEAVE sessionId=$sessionId");
            } else {
                // Preserve first login time (loginAt) across heartbeats; set on first sighting
                $existing = isset($map[$sessionId]) && is_array($map[$sessionId]) ? $map[$sessionId] : null;
                $loginAt = isset($existing['loginAt']) ? intval($existing['loginAt']) : $now;
                $prevLocks = isset($existing['locks']) && is_array($existing['locks']) ? $existing['locks'] : [];
                // Merge locks (latest until wins)
                foreach ($locks as $fid => $until) {
                    $prev = isset($prevLocks[$fid]) ? intval($prevLocks[$fid]) : 0;
                    if ($until > $prev) $prevLocks[$fid] = $until;
                }
                $map[$sessionId] = [
                    'sessionId' => $sessionId,
                    'displayName' => $displayName,
                    'role' => $role,
                    'page' => $page,
                    'loginAt' => $loginAt,
                    'lastSeen' => $now,
                    'locks' => $prevLocks,
                ];
                presence_log("$reqId HEARTBEAT sessionId=$sessionId role=$role page=$page locks=" . count($locks) . " loginAt=$loginAt");
            }
        }, $reqId);

        if ($users === false) {
            throw new Exception('Atomic presence update failed');
        }

        // Respond with current active list
        usort($users, function($a,$b){ return ($b['lastSeen'] ?? 0) <=> ($a['lastSeen'] ?? 0); });
        $resp = [ 'success' => true, 'users' => $users ];
        echo json_encode($resp, JSON_UNESCAPED_UNICODE);
        presence_log("$reqId RESP POST users=" . count($users));
        exit;
    } catch (Exception $e) {
        presence_log("$reqId ERROR POST: " . $e->getMessage());
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
}

if ($method === 'GET') {
    // Return active users
    $users = read_presence($presenceFile);
    $users = cleanup_expired($users, $TTL_SECONDS);
    usort($users, function($a,$b){ return ($b['lastSeen'] ?? 0) <=> ($a['lastSeen'] ?? 0); });

    $debug = [];
    if (isset($_GET['debug'])) {
        $debug = [
            'presenceFile' => $presenceFile,
            'fileExists' => file_exists($presenceFile),
            'fileWritable' => is_writable(dirname($presenceFile)),
            'fileMTime' => file_exists($presenceFile) ? @filemtime($presenceFile) : null,
            'server' => [ 'ip' => ($_SERVER['SERVER_ADDR'] ?? null), 'php' => PHP_VERSION ],
        ];
    }

    $resp = [
        'success' => true,
        'users' => $users,
        'ttl' => $TTL_SECONDS,
    ];
    if ($debug) $resp['debug'] = $debug;
    echo json_encode($resp, JSON_UNESCAPED_UNICODE);
    presence_log("$reqId RESP GET users=" . count($users));
    exit;
}

http_response_code(405);
presence_log("$reqId ERROR 405 method not allowed");
echo json_encode([
    'success' => false,
    'error' => 'Method not allowed',
    'allowed' => ['GET','POST','OPTIONS'],
]);

