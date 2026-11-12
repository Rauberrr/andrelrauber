<?php
/**
 * Lembretes dos hábitos no navegador. Roda a cada 5 minutos (ou 15, se a hospedagem não deixar
 * menos) pelo "Cron Jobs" do cPanel, nunca pelo navegador:
 *
 *   * /5 * * * *   /usr/local/bin/php /home2/and63667/public_html/api/tarefas/habitos.php
 *   (sem o espaço entre o asterisco e a barra)
 *
 * Para cada pessoa com lembretes ligados num aparelho:
 * - na hora marcada de cada hábito do dia, se ainda não foi feito;
 * - às 20h, o resgate: o hábito (com lembrete) ficou para trás no último dia e ainda não foi feito hoje;
 * - os lembretes simples: uma vez numa data, todo dia ou em dias da semana, na hora marcada.
 * As horas seguem o fuso do aparelho da pessoa. Nunca repete o mesmo aviso.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

define('AR_API', true);
require __DIR__ . '/../nucleo.php';
require __DIR__ . '/../push.php';

const HAB_JANELA_MINUTOS = 20;
const HAB_HORA_RESGATE = '20:00';

// Para testar: "agora" pode vir como argumento, no formato 2026-11-11T07:30:00Z
$agora = isset($argv[1]) ? (int) strtotime($argv[1]) : time();

function minutos(string $hora): int
{
    [$h, $m] = array_map('intval', explode(':', $hora));
    return $h * 60 + $m;
}

function na_janela(string $hora, int $agoraMin): bool
{
    $inicio = minutos($hora);
    return $agoraMin >= $inicio && $agoraMin < $inicio + HAB_JANELA_MINUTOS;
}

function feito(array $registros, string $data, string $habito): bool
{
    $r = $registros[$data][$habito] ?? '';
    return $r === 'feito' || $r === 'minimo';
}

// O último dia antes de hoje em que o hábito estava marcado
function dia_anterior(array $h, DateTimeImmutable $hoje): ?string
{
    for ($i = 1; $i <= 7; $i++) {
        $d = $hoje->modify("-$i day");
        if ($d->format('Y-m-d') < ($h['criadoEm'] ?? '')) {
            return null;
        }
        if (in_array((int) $d->format('w'), $h['dias'], true)) {
            return $d->format('Y-m-d');
        }
    }
    return null;
}

function ja_avisado(int $usuarioId, string $chave): bool
{
    return consultar('SELECT 1 FROM lembretes_enviados WHERE usuario_id = ? AND chave = ?', [$usuarioId, $chave])->fetchColumn() !== false;
}

function marcar_avisado(int $usuarioId, string $chave): void
{
    consultar('INSERT INTO lembretes_enviados (usuario_id, chave, enviado_em) VALUES (?, ?, ?)', [$usuarioId, mb_substr($chave, 0, 100), agora()]);
}

// Marca quando rodou: o app e o painel mostram se a tarefa do Cron está ligada
try {
    gravar_ajuste('tarefa_habitos_em', time());
} catch (PDOException $erro) {
    // Banco ainda sem a tabela de ajustes: os lembretes saem do mesmo jeito
}

$linhas = consultar(
    "SELECT a.usuario_id, a.dados FROM apps_dados a
     WHERE a.app = 'habitos' AND EXISTS (SELECT 1 FROM push_inscricoes p WHERE p.usuario_id = a.usuario_id)"
)->fetchAll();

$total = 0;
foreach ($linhas as $linha) {
    $id = (int) $linha['usuario_id'];
    $pessoa = consultar('SELECT * FROM usuarios WHERE id = ?', [$id])->fetch();
    if (!$pessoa || !acesso_aos_apps($pessoa)) {
        continue;
    }
    $dados = json_decode((string) $linha['dados'], true);
    if (!is_array($dados) || ($dados['avisos'] ?? false) !== true || !is_array($dados['habitos'] ?? null)) {
        continue;
    }
    if (!$dados['habitos'] && empty($dados['lembretes'])) {
        continue;
    }
    $fuso = in_array($dados['fuso'] ?? '', timezone_identifiers_list(), true) ? $dados['fuso'] : 'America/Sao_Paulo';
    $local = (new DateTimeImmutable('@' . $agora))->setTimezone(new DateTimeZone($fuso));
    $hoje = $local->format('Y-m-d');
    $semana = (int) $local->format('w');
    $agoraMin = (int) $local->format('G') * 60 + (int) $local->format('i');
    $registros = is_array($dados['registros'] ?? null) ? $dados['registros'] : [];

    $novos = [];
    foreach ($dados['habitos'] as $h) {
        if (!is_array($h) || !in_array($semana, $h['dias'] ?? [], true) || ($h['criadoEm'] ?? '') > $hoje || feito($registros, $hoje, $h['id'])) {
            continue;
        }
        $nome = (string) $h['nome'];
        $minima = (string) ($h['minima'] ?? '');
        // Na hora marcada
        if (($h['lembrete'] ?? false) === true && ($h['hora'] ?? '') !== '' && na_janela($h['hora'], $agoraMin)) {
            $chave = 'hab-' . $h['id'] . '-' . $hoje;
            if (!ja_avisado($id, $chave)) {
                marcar_avisado($id, $chave);
                $ancora = (string) ($h['ancora'] ?? '');
                $texto = $minima !== '' ? 'Comece pelo mínimo: ' . $minima . '.' : 'É hora. Comece pequeno, mas comece.';
                if ($ancora !== '') {
                    $texto = 'Depois de ' . $ancora . '. ' . $texto;
                }
                $novos[] = [$nome, $texto];
            }
        }
        // O resgate da noite: nunca falhe duas vezes
        if (($h['lembrete'] ?? false) === true && na_janela(HAB_HORA_RESGATE, $agoraMin)) {
            $antes = dia_anterior($h, $local);
            $chave = 'res-' . $h['id'] . '-' . $hoje;
            if ($antes !== null && !feito($registros, $antes, $h['id']) && !ja_avisado($id, $chave)) {
                marcar_avisado($id, $chave);
                $novos[] = [$nome . ': não falhe duas vezes', 'Ficou para trás da última vez. Hoje vale até o mínimo' . ($minima !== '' ? ': ' . $minima : '') . '.'];
            }
        }
    }
    // Lembretes simples: só o texto e a hora
    foreach ((is_array($dados['lembretes'] ?? null) ? $dados['lembretes'] : []) as $l) {
        if (!is_array($l) || !is_string($l['id'] ?? null) || ($l['hora'] ?? '') === '' || !na_janela((string) $l['hora'], $agoraMin)) {
            continue;
        }
        $repetir = (string) ($l['repetir'] ?? 'uma');
        $vale = ($repetir === 'uma' && ($l['data'] ?? '') === $hoje)
            || $repetir === 'diario'
            || ($repetir === 'dias' && in_array($semana, is_array($l['dias'] ?? null) ? $l['dias'] : [], true));
        $chave = 'lem-' . $l['id'] . '-' . $hoje;
        if ($vale && !ja_avisado($id, $chave)) {
            marcar_avisado($id, $chave);
            $novos[] = [(string) $l['texto'], 'Lembrete das ' . str_replace(':', 'h', (string) $l['hora']) . '. Toque para abrir.', 'lembrete'];
        }
    }
    if (!$novos) {
        continue;
    }
    $avisos = [];
    foreach ($novos as $n) {
        $marca = $n[2] ?? 'habitos';
        consultar(
            'INSERT INTO avisos_push (usuario_id, titulo, texto, marca, criado_em) VALUES (?, ?, ?, ?, ?)',
            [$id, mb_substr($n[0], 0, 80), mb_substr($n[1], 0, 200), $marca, agora()]
        );
        $avisos[] = ['titulo' => $n[0], 'texto' => $n[1], 'marca' => $marca];
    }
    // Uma notificação por aparelho, com o aviso dentro (ou o resumo, se forem vários)
    $total += cutucar_aparelhos($id, $avisos);
}

echo 'Aparelhos avisados: ' . $total . PHP_EOL;
