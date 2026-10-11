<?php
// Réception du formulaire de contact (hébergement PHP, ex. OVH). Répond en JSON.
// Réglages : destinataire, expéditeur technique (doit appartenir au domaine pour passer les filtres anti-spam).
$TO   = 'contact@williamsharper.com';
$FROM = 'site@williams-harper.com';
$MAX_PER_HOUR = 20;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'method']); exit; }

$raw = file_get_contents('php://input');
$d = json_decode($raw, true);
if (!is_array($d)) { $d = $_POST; }
$f = fn($k) => trim((string)($d[$k] ?? ''));

// Pot de miel : les robots remplissent le champ caché.
if ($f('website') !== '') { echo json_encode(['ok'=>true]); exit; }

$name = mb_substr($f('name'), 0, 120);
$email = mb_substr($f('email'), 0, 160);
$phone = mb_substr($f('phone'), 0, 40);
$villa = mb_substr($f('villa'), 0, 60);
$msg = mb_substr($f('message'), 0, 4000);
$lang = $f('lang') === 'en' ? 'en' : 'fr';
$page = mb_substr($f('page'), 0, 200);
$consent = $f('consent') !== '';

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$consent) {
  http_response_code(422); echo json_encode(['ok'=>false,'error'=>'invalid']); exit;
}
// Anti-injection d'en-têtes
foreach ([$name, $email, $phone, $villa] as $v) { if (preg_match('/[\r\n]/', $v)) { http_response_code(422); echo json_encode(['ok'=>false,'error'=>'invalid']); exit; } }

// Limitation simple : N envois par heure et par adresse IP (fichier temporaire).
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$bucket = sys_get_temp_dir() . '/wh-rate-' . md5($ip) . '-' . date('YmdH');
$n = (int)@file_get_contents($bucket);
if ($n >= $MAX_PER_HOUR) { http_response_code(429); echo json_encode(['ok'=>false,'error'=>'rate']); exit; }
@file_put_contents($bucket, $n + 1);

$subject = '=?UTF-8?B?' . base64_encode('Demande — ' . ($villa !== '' ? $villa : 'Williams & Harper') . ' — ' . $name) . '?=';
$body = "Nouvelle demande depuis le site williams-harper.com\n\n"
      . "Nom : $name\nE-mail : $email\nTéléphone : $phone\nVilla : $villa\nLangue : $lang\nPage : $page\n"
      . "Date : " . date('d/m/Y H:i') . "\nIP : $ip\n\nMessage :\n$msg\n";
$headers = "From: Williams & Harper <$FROM>\r\nReply-To: $name <$email>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
$ok = @mail($TO, $subject, $body, $headers, "-f$FROM");

// Journal local (hors web si possible) pour ne perdre aucune demande.
$log = __DIR__ . '/../wh-demandes.log';
if (!is_writable(dirname($log))) { $log = __DIR__ . '/.wh-demandes.log'; }
@file_put_contents($log, date('c') . "\t" . json_encode(['name'=>$name,'email'=>$email,'phone'=>$phone,'villa'=>$villa,'lang'=>$lang,'page'=>$page,'message'=>$msg,'mail'=>$ok], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

// Accusé de réception au visiteur.
if ($ok) {
  $ack = $lang === 'en'
    ? "Thank you, $name.\n\nWe have received your request regarding $villa and will come back to you within two working days.\n\nWilliams & Harper\n+212 6 17 17 47 78 · contact@williamsharper.com\nDomaine Red Stone, Marrakech"
    : "Merci, $name.\n\nNous avons bien reçu votre demande concernant $villa et vous répondrons sous 48 h ouvrées.\n\nWilliams & Harper\n+212 6 17 17 47 78 · contact@williamsharper.com\nDomaine Red Stone, Marrakech";
  $ackSubject = '=?UTF-8?B?' . base64_encode($lang === 'en' ? 'Your request — Williams & Harper' : 'Votre demande — Williams & Harper') . '?=';
  @mail($email, $ackSubject, $ack, "From: Williams & Harper <$FROM>\r\nReply-To: $TO\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n", "-f$FROM");
}
echo json_encode(['ok'=>(bool)$ok]);
