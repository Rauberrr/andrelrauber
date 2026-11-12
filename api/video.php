<?php
/**
 * Entrega um vídeo do painel por um link temporário e assinado, para a rede baixar.
 * GET ?v=ID&ate=EXPIRA&ass=ASSINATURA   (o link sai de link_do_video(), em redes.php)
 * Sem a assinatura certa, ou depois do prazo, responde 404 e não diz se o vídeo existe.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/redes.php';

function sem_video(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(404);
    echo 'Não encontrado.';
    exit;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metodo !== 'GET' && $metodo !== 'HEAD') {
    sem_video();
}
$id = (int) ($_GET['v'] ?? 0);
$ate = (int) ($_GET['ate'] ?? 0);
$assinatura = (string) ($_GET['ass'] ?? '');
if ($id <= 0 || $ate < time() || $assinatura === '') {
    sem_video();
}
$video = consultar('SELECT * FROM videos WHERE id = ?', [$id])->fetch();
if (!$video || !hash_equals(assinatura_do_video($video, $ate), $assinatura) || (int) $video['recebido'] < (int) $video['tamanho']) {
    sem_video();
}
$caminho = caminho_do_video($video);
if (!is_file($caminho)) {
    sem_video();
}

$tamanho = (int) filesize($caminho);
$inicio = 0;
$fim = $tamanho - 1;
$parcial = false;
if (preg_match('/^bytes=(\d*)-(\d*)$/', (string) ($_SERVER['HTTP_RANGE'] ?? ''), $m) && ($m[1] !== '' || $m[2] !== '')) {
    if ($m[1] === '') {
        $inicio = max(0, $tamanho - (int) $m[2]);
    } else {
        $inicio = (int) $m[1];
        $fim = $m[2] === '' ? $fim : min($fim, (int) $m[2]);
    }
    if ($inicio > $fim || $inicio >= $tamanho) {
        header('Content-Range: bytes */' . $tamanho);
        http_response_code(416);
        exit;
    }
    $parcial = true;
}

header_remove('Cache-Control');
header('Cache-Control: private, no-store');
header('Content-Type: ' . ((string) $video['tipo'] === 'video/quicktime' ? 'video/quicktime' : 'video/mp4'));
header('Accept-Ranges: bytes');
header('Content-Length: ' . ($fim - $inicio + 1));
if ($parcial) {
    http_response_code(206);
    header('Content-Range: bytes ' . $inicio . '-' . $fim . '/' . $tamanho);
}
if ($metodo === 'HEAD') {
    exit;
}

set_time_limit(0);
while (ob_get_level() > 0) {
    ob_end_clean();
}
$arquivo = fopen($caminho, 'rb');
fseek($arquivo, $inicio);
$faltam = $fim - $inicio + 1;
while ($faltam > 0 && !feof($arquivo) && !connection_aborted()) {
    $bloco = fread($arquivo, (int) min(1048576, $faltam));
    if ($bloco === false || $bloco === '') {
        break;
    }
    echo $bloco;
    flush();
    $faltam -= strlen($bloco);
}
fclose($arquivo);
