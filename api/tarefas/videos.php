<?php
/**
 * Publica os vídeos agendados. Roda pelo "Cron Jobs" do cPanel, nunca pelo navegador.
 * De 5 em 5 minutos, se a hospedagem deixar (senão de 15 em 15):
 *
 *   /usr/local/bin/php /home2/and63667/public_html/api/tarefas/videos.php
 *
 * Também continua o que ficou pela metade (envio grande, rede ainda processando)
 * e apaga do servidor os vídeos que já saíram em todas as redes.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

define('AR_API', true);
require __DIR__ . '/../nucleo.php';
require __DIR__ . '/../redes.php';

@set_time_limit(0);
$fim = time() + 12 * 60;
$feitas = 0;

$pendentes = consultar(
    "SELECT id FROM publicacoes WHERE situacao IN ('agendada', 'enviando', 'processando') AND agendado_para <= ? ORDER BY agendado_para, id",
    [agora()]
)->fetchAll(PDO::FETCH_COLUMN);
foreach ($pendentes as $id) {
    if (time() >= $fim) {
        break;
    }
    $p = processar_publicacao((int) $id, (int) min(300, $fim - time()));
    if (($p['situacao'] ?? '') === 'publicada') {
        $feitas++;
    }
}

// Vídeos que já terminaram em todas as redes, ou enviados e nunca publicados, saem depois de 3 dias
$antigo = date('Y-m-d H:i:s', time() - 3 * 86400);
$videos = consultar('SELECT * FROM videos WHERE criado_em < ?', [$antigo])->fetchAll();
foreach ($videos as $v) {
    $abertas = (int) consultar(
        "SELECT COUNT(*) FROM publicacoes WHERE video_id = ? AND (situacao IN ('agendada', 'enviando', 'processando') OR (situacao = 'erro' AND atualizado_em >= ?))",
        [$v['id'], $antigo]
    )->fetchColumn();
    if ($abertas === 0) {
        @unlink(caminho_do_video($v));
        consultar('UPDATE videos SET recebido = 0, arquivo = ? WHERE id = ?', ['apagado-' . $v['id'], $v['id']]);
    }
}

echo 'Publicações feitas: ' . $feitas . PHP_EOL;
