<?php
// sync/send-mail.php - Send current plan as PDF attachment via email and expose last-10 log
// Uses simple mail() with MIME; logs to mail_log.json and mail_outbox.txt on failure.

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$BASE_DIR = __DIR__;
$LOG_FILE = $BASE_DIR . '/mail_log.json';
$OUTBOX_FILE = $BASE_DIR . '/mail_outbox.txt';
$USERS_FILE = $BASE_DIR . '/users.json'; // not used directly; session provides user info

// Load config (mailFrom)
$config = [ 'mailFrom' => 'info@hangarplaner.de' ];
$configPath = $BASE_DIR . '/config.php';
if (file_exists($configPath)) {
  try { $loaded = include $configPath; if (is_array($loaded)) $config = array_merge($config, $loaded); } catch (Throwable $t) {}
} else {
  $examplePath = $BASE_DIR . '/config.example.php';
  if (file_exists($examplePath)) { try { $loaded = include $examplePath; if (is_array($loaded)) $config = array_merge($config, $loaded); } catch (Throwable $t) {} }
}

// Ensure session matches auth.php
$SESSION_NAME = 'hangar_auth';
if (session_status() === PHP_SESSION_NONE) { session_name($SESSION_NAME); @session_start(); }

function respond($arr, $code=200){ http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }

function read_log($file){
  if (!file_exists($file)) return [];
  $raw = @file_get_contents($file);
  if ($raw === false || $raw==='') return [];
  $json = json_decode($raw, true);
  return is_array($json) ? $json : [];
}
function write_log($file, $arr){
  $dir = dirname($file);
  if (!is_dir($dir)) @mkdir($dir, 0777, true);
  $payload = json_encode($arr, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
  if ($payload === false) return false;
  $ok = @file_put_contents($file, $payload, LOCK_EX) !== false;
  if ($ok) @chmod($file, 0664);
  return $ok;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? strtolower($_GET['action']) : '';

if ($method === 'GET' && $action === 'log'){
  $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
  $all = read_log($LOG_FILE);
  // return latest first
  $all = array_values($all);
  $cnt = count($all);
  $slice = [];
  if ($cnt > 0){
    $slice = array_slice($all, max(0, $cnt - $limit));
  }
  respond([ 'success'=>true, 'logs'=>$slice ]);
}

if ($method !== 'POST') { respond([ 'success'=>false, 'error'=>'Method not allowed' ], 405); }

$raw = @file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) respond([ 'success'=>false, 'error'=>'Invalid JSON' ], 400);

$recipients = isset($body['recipients']) && is_array($body['recipients']) ? $body['recipients'] : [];
$cc         = isset($body['cc']) && is_array($body['cc']) ? $body['cc'] : [];
$subject    = isset($body['subject']) ? trim((string)$body['subject']) : '';
$msgText    = isset($body['body']) ? (string)$body['body'] : '';
$pdfName    = isset($body['pdfFilename']) ? trim((string)$body['pdfFilename']) : 'hangar_plan.pdf';
$pdfBase64  = isset($body['pdfBase64']) ? (string)$body['pdfBase64'] : '';

if (!$recipients) respond([ 'success'=>false, 'error'=>'No recipients' ], 400);
$validRecipients = [];
foreach ($recipients as $r){ $r = trim((string)$r); if ($r !== '' && filter_var($r, FILTER_VALIDATE_EMAIL)) $validRecipients[] = $r; }
$validCc = [];
foreach ($cc as $r){ $r = trim((string)$r); if ($r !== '' && filter_var($r, FILTER_VALIDATE_EMAIL)) $validCc[] = $r; }
if (count($validRecipients) === 0) respond([ 'success'=>false, 'error'=>'Invalid recipients' ], 400);
if ($subject === '') $subject = 'Hangar Plan';

// Decode base64 - support data URL prefix
if (preg_match('/^data:.*;base64,(.*)$/', $pdfBase64, $m)) { $pdfBase64 = $m[1]; }
$binary = base64_decode($pdfBase64, true);
if ($binary === false || strlen($binary) === 0) respond([ 'success'=>false, 'error'=>'Invalid PDF data' ], 400);

$userEmail = '';
if (!empty($_SESSION['user']) && isset($_SESSION['user']['email'])) $userEmail = (string)$_SESSION['user']['email'];

$from = isset($config['mailFrom']) && filter_var($config['mailFrom'], FILTER_VALIDATE_EMAIL) ? $config['mailFrom'] : 'info@hangarplaner.de';
$boundary = 'np_' . bin2hex(random_bytes(8));
$headers = '';
$headers .= 'From: ' . $from . "\r\n";
$headers .= 'Reply-To: ' . $from . "\r\n"; // non-reply mailbox
if (!empty($validCc)) { $headers .= 'Cc: ' . implode(', ', $validCc) . "\r\n"; }
$headers .= "MIME-Version: 1.0\r\n";
$headers .= 'X-Auto-Response-Suppress: All' . "\r\n";
$headers .= 'Auto-Submitted: auto-generated' . "\r\n";
$headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

$textPart  = "--$boundary\r\n";
$textPart .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
$textPart .= $msgText . "\r\n\r\n";

$attachment  = "--$boundary\r\n";
$attachment .= "Content-Type: application/pdf; name=\"" . addslashes($pdfName) . "\"\r\n";
$attachment .= "Content-Transfer-Encoding: base64\r\n";
$attachment .= "Content-Disposition: attachment; filename=\"" . addslashes($pdfName) . "\"\r\n\r\n";
$attachment .= chunk_split(base64_encode($binary)) . "\r\n";
$closing = "--$boundary--";

$to = implode(', ', $validRecipients);
$payload = $textPart . $attachment . $closing;

$ok = @mail($to, $subject, $payload, $headers);
if (!$ok){
  $ts = date('c');
  @file_put_contents($OUTBOX_FILE, "[$ts]\nTO: $to\nCC: " . (implode(', ', $validCc)) . "\nSUBJECT: $subject\nFROM: $from\n\n(Failed to send via mail())\n\n---\n", FILE_APPEND);
  @chmod($OUTBOX_FILE, 0664);
}

// Append to log (keep last 100)
$log = read_log($LOG_FILE);
$log[] = [
  'timestamp' => date('c'),
  'userEmail' => $userEmail,
  'recipients' => $validRecipients,
  'cc' => $validCc,
  'subject' => $subject,
  'from' => $from,
  'ok' => (bool)$ok,
];
if (count($log) > 100) {
  $log = array_slice($log, -100);
}
write_log($LOG_FILE, $log);

respond([ 'success'=>true, 'sent'=> (bool)$ok ]);
