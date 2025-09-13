<?php
// sync/auth.php - File-based authentication with admin approval and blocking
// Actions: register, login, logout, session, approve (via email link), admin_login, admin_logout, admin_list, admin_block, admin_unblock

// CORS and JSON headers to mirror other endpoints
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$BASE_DIR = __DIR__;
$USERS_FILE = $BASE_DIR . '/users.json';
$MAIL_OUTBOX = $BASE_DIR . '/mail_outbox.txt';
$SESSION_NAME = 'hangar_auth';

// Load admin config (email, secret)
$config = [
    'adminEmail' => null, // set in config.php (gitignored)
    'adminSecret' => null,
    'mailFrom' => 'no-reply@hangarplanner.local'
];
$configPath = $BASE_DIR . '/config.php';
if (file_exists($configPath)) {
    try { $loaded = include $configPath; if (is_array($loaded)) $config = array_merge($config, $loaded); } catch (Throwable $t) {}
} else {
    // Fallback to example config in development if real config is missing
    $examplePath = $BASE_DIR . '/config.example.php';
    if (file_exists($examplePath)) {
        try { $loaded = include $examplePath; if (is_array($loaded)) $config = array_merge($config, $loaded); } catch (Throwable $t) {}
    }
}

// Ensure session
if (session_status() === PHP_SESSION_NONE) {
    session_name($SESSION_NAME);
    @session_start();
}

function respond($arr, $code = 200) {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_users($file) {
    if (!file_exists($file)) return [ 'users' => [] ];
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') return [ 'users' => [] ];
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [ 'users' => [] ];
}

function write_users_atomic($file, $data) {
    $dir = dirname($file);
    if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
    $fp = @fopen($file, 'c+');
    if (!$fp) return false;
    if (!@flock($fp, LOCK_EX)) { @fclose($fp); return false; }
    @ftruncate($fp, 0);
    @rewind($fp);
    $payload = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($payload === false) { $payload = '{"users":[]}'; }
    $wrote = @fwrite($fp, $payload);
    @fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);
    @chmod($file, 0664);
    return $wrote !== false;
}

function find_user(&$db, $email) {
    $email = strtolower(trim($email));
    foreach ($db['users'] as &$u) {
        if (isset($u['email']) && strtolower($u['email']) === $email) return $u;
    }
    return null;
}

function send_admin_approval_mail($to, $subject, $body, $outbox, $from = 'no-reply@hangarplanner.local') {
    // Validate recipient and build headers using configured From/Reply-To
    $fromHdr = filter_var($from, FILTER_VALIDATE_EMAIL) ? $from : 'no-reply@hangarplanner.local';
    $headers = 'From: ' . $fromHdr . "\r\n" .
               'Reply-To: ' . $fromHdr . "\r\n" .
               'Content-Type: text/plain; charset=UTF-8';
    $ok = false;
    if (filter_var($to, FILTER_VALIDATE_EMAIL)) {
        $ok = @mail($to, $subject, $body, $headers);
    }
    if (!$ok) {
        $ts = date('c');
        $toLog = filter_var($to, FILTER_VALIDATE_EMAIL) ? $to : 'INVALID_OR_MISSING';
        @file_put_contents($outbox, "[$ts]\nTO: $toLog\nSUBJECT: $subject\n\n$body\n\n---\n", FILE_APPEND);
        @chmod($outbox, 0664);
    }
    return $ok;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? strtolower($_GET['action']) : null;
if ($method === 'POST') {
    $raw = @file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (isset($body['action'])) $action = strtolower($body['action']);
}

if (!$action) {
    respond([ 'success' => false, 'error' => 'Missing action' ], 400);
}

switch ($action) {
    case 'register': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $displayName = trim($body['displayName'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['success'=>false,'error'=>'Invalid email'],400);
        if (strlen($password) < 8) respond(['success'=>false,'error'=>'Password must be at least 8 characters'],400);
        if ($displayName === '') $displayName = strstr($email, '@', true);

        $db = read_users($USERS_FILE);
        $existing = find_user($db, $email);
        if ($existing) respond(['success'=>false,'error'=>'User already exists'],409);

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $token = bin2hex(random_bytes(16));
        $user = [
            'email' => $email,
            'displayName' => $displayName,
            'passwordHash' => $hash,
            'approved' => false,
            'blocked' => false,
            'approvalToken' => $token,
            'createdAt' => date('c'),
            'approvedAt' => null,
            'blockedAt' => null
        ];
        $db['users'][] = $user;
        if (!write_users_atomic($USERS_FILE, $db)) respond(['success'=>false,'error'=>'Failed to save user'],500);

        // Compose admin approval email (unexposed address from config)
        $approveUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . dirname($_SERVER['REQUEST_URI'] ?? '/sync/auth.php') . '/auth.php?action=approve&token=' . urlencode($token);
        $subject = 'Hangar Planner: Approve new user';
        $bodyMail = "A new user registered:\n\nEmail: $email\nName: $displayName\n\nApprove this user by opening:\n$approveUrl\n\nIf you did not request this, ignore this message.";
        send_admin_approval_mail($config['adminEmail'], $subject, $bodyMail, $MAIL_OUTBOX, $config['mailFrom'] ?? 'no-reply@hangarplanner.local');

        respond(['success'=>true, 'message'=>'Registration submitted. Admin approval required.']);
    }
    case 'approve': {
        if ($method !== 'GET') respond(['success'=>false,'error'=>'Method not allowed'],405);
        $token = trim($_GET['token'] ?? '');
        if ($token === '') respond(['success'=>false,'error'=>'Missing token'],400);
        $db = read_users($USERS_FILE);
        $changed = false;
        foreach ($db['users'] as &$u) {
            if (isset($u['approvalToken']) && hash_equals($u['approvalToken'], $token)) {
                $u['approved'] = true;
                $u['approvedAt'] = date('c');
                $u['approvalToken'] = null; // invalidate token
                $changed = true;
                break;
            }
        }
        if (!$changed) respond(['success'=>false,'error'=>'Invalid token'],400);
        if (!write_users_atomic($USERS_FILE, $db)) respond(['success'=>false,'error'=>'Failed to update user'],500);
        // Render a minimal HTML confirmation so admin can click easily from email
        header('Content-Type: text/html; charset=UTF-8');
        echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>User approved</title></head><body style="font-family: system-ui; padding: 24px;">';
        echo '<h2>✅ User approved</h2><p>The user has been approved. They can now log in.</p></body></html>';
        exit;
    }
    case 'login': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['success'=>false,'error'=>'Invalid email'],400);
        $db = read_users($USERS_FILE);
        $u = find_user($db, $email);
        if (!$u || empty($u['passwordHash']) || !password_verify($password, $u['passwordHash'])) {
            respond(['success'=>false,'error'=>'Invalid credentials'],401);
        }
        if (!empty($u['blocked'])) respond(['success'=>false,'error'=>'User is blocked'],403);
        if (empty($u['approved'])) respond(['success'=>false,'error'=>'Account not approved yet'],403);
        $_SESSION['user'] = [ 'email' => $u['email'], 'displayName' => $u['displayName'] ?? strstr($u['email'],'@',true) ];
        respond(['success'=>true, 'user'=>$_SESSION['user']]);
    }
    case 'logout': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        @session_destroy();
        respond(['success'=>true]);
    }
    case 'session': {
        if (!empty($_SESSION['user'])) respond(['success'=>true,'user'=>$_SESSION['user']]);
        respond(['success'=>false], 200);
    }
    // Admin operations (use adminSecret from config.php or POST body)
    case 'admin_login': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        $secret = trim($body['secret'] ?? '');
        $expected = (string)($config['adminSecret'] ?? '');
        if ($expected === '' || !hash_equals($expected, $secret)) respond(['success'=>false,'error'=>'Invalid admin secret'],403);
        $_SESSION['admin'] = true;
        respond(['success'=>true]);
    }
    case 'admin_logout': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        unset($_SESSION['admin']);
        respond(['success'=>true]);
    }
    case 'admin_list': {
        if (empty($_SESSION['admin'])) respond(['success'=>false,'error'=>'Not authorized'],403);
        $db = read_users($USERS_FILE);
        $list = array_map(function($u){
            return [
                'email' => $u['email'],
                'displayName' => $u['displayName'] ?? '',
                'approved' => (bool)($u['approved'] ?? false),
                'blocked' => (bool)($u['blocked'] ?? false),
                'createdAt' => $u['createdAt'] ?? null,
                'approvedAt' => $u['approvedAt'] ?? null,
            ];
        }, $db['users']);
        respond(['success'=>true, 'users'=>$list]);
    }
    case 'admin_block': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        if (empty($_SESSION['admin'])) respond(['success'=>false,'error'=>'Not authorized'],403);
        $email = strtolower(trim($body['email'] ?? ''));
        $db = read_users($USERS_FILE);
        $changed = false;
        foreach ($db['users'] as &$u) {
            if (strtolower($u['email']) === $email) {
                $u['blocked'] = true; $u['blockedAt'] = date('c'); $changed = true; break;
            }
        }
        if (!$changed) respond(['success'=>false,'error'=>'User not found'],404);
        if (!write_users_atomic($USERS_FILE, $db)) respond(['success'=>false,'error'=>'Failed to update user'],500);
        respond(['success'=>true]);
    }
    case 'admin_unblock': {
        if ($method !== 'POST') respond(['success'=>false,'error'=>'Method not allowed'],405);
        if (empty($_SESSION['admin'])) respond(['success'=>false,'error'=>'Not authorized'],403);
        $email = strtolower(trim($body['email'] ?? ''));
        $db = read_users($USERS_FILE);
        $changed = false;
        foreach ($db['users'] as &$u) {
            if (strtolower($u['email']) === $email) {
                $u['blocked'] = false; $changed = true; break;
            }
        }
        if (!$changed) respond(['success'=>false,'error'=>'User not found'],404);
        if (!write_users_atomic($USERS_FILE, $db)) respond(['success'=>false,'error'=>'Failed to update user'],500);
        respond(['success'=>true]);
    }
    default:
        respond(['success'=>false,'error'=>'Unknown action'],400);
}

