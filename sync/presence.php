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

// OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
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
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    return @file_put_contents($file, $payload, LOCK_EX) !== false;
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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        $raw = @file_get_contents('php://input');
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

        // Read current users, cleanup expired
        $users = read_presence($presenceFile);
        $users = cleanup_expired($users, $TTL_SECONDS);

        $now = time();
        $updated = false;

        if ($action === 'leave') {
            // Remove this session explicitly
            $new = [];
            foreach ($users as $u) {
                if (!isset($u['sessionId']) || $u['sessionId'] !== $sessionId) $new[] = $u;
            }
            $users = $new;
            $updated = true;
        } else { // heartbeat default
            $found = false;
            foreach ($users as &$u) {
                if (isset($u['sessionId']) && $u['sessionId'] === $sessionId) {
                    $u['displayName'] = $displayName;
                    $u['role'] = $role;
                    $u['page'] = $page;
                    $u['lastSeen'] = $now;
                    $found = true;
                    break;
                }
            }
            unset($u);
            if (!$found) {
                $users[] = [
                    'sessionId' => $sessionId,
                    'displayName' => $displayName,
                    'role' => $role,
                    'page' => $page,
                    'lastSeen' => $now,
                ];
            }
            $updated = true;
        }

        if ($updated) write_presence($presenceFile, $users);

        // Respond with current active list
        usort($users, function($a,$b){ return ($b['lastSeen'] ?? 0) <=> ($a['lastSeen'] ?? 0); });
        echo json_encode([
            'success' => true,
            'users' => $users,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e) {
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
    echo json_encode([
        'success' => true,
        'users' => $users,
        'ttl' => $TTL_SECONDS,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode([
    'success' => false,
    'error' => 'Method not allowed',
    'allowed' => ['GET','POST','OPTIONS'],
]);

