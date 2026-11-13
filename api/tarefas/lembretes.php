<?php
/**
 * Lembretes por e-mail. Roda uma vez por dia pelo "Cron Jobs" do cPanel, nunca pelo navegador:
 *
 *   /usr/local/bin/php /home2/and63667/public_html/api/tarefas/lembretes.php
 *
 * Avisa quem ligou os lembretes:
 * - Alimentação: item da lista de compras que acaba em até 2 dias;
 * - Ocasiões: data limite para encomendar a peça chegando (até 3 dias) e evento na semana.
 * Só envia para e-mails confirmados e nunca repete o mesmo aviso.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

define('AR_API', true);
require __DIR__ . '/../nucleo.php';
marcar_tarefa('lembretes');

// Uma vez por dia, confere no Mercado Pago as assinaturas que estão valendo (caso algum aviso tenha se perdido)
require_once __DIR__ . '/../mercadopago.php';
if (mp_ativo()) {
    try {
        foreach (consultar("SELECT preapproval_id FROM assinaturas_mp WHERE status IN ('authorized', 'paused')")->fetchAll(PDO::FETCH_COLUMN) as $pre) {
            mp_sincronizar_assinatura((string) $pre);
        }
    } catch (PDOException $erro) {
        // Banco ainda sem a tabela das assinaturas
    }
}

const LEMBRETE_ALIMENTO_DIAS = 2;
const LEMBRETE_ENCOMENDA_DIAS = 3;
const LEMBRETE_EVENTO_DIAS = 7;

$hoje = date('Y-m-d');
$siteUrl = rtrim((string) (config()['site_url'] ?? 'https://andrerauber.com'), '/');

function dias_ate(string $de, string $ate): int
{
    return (int) round((strtotime($ate . ' 12:00:00') - strtotime($de . ' 12:00:00')) / 86400);
}

function data_curta(string $iso): string
{
    $p = explode('-', $iso);
    return ($p[2] ?? '') . '/' . ($p[1] ?? '');
}

function quando(int $dias): string
{
    if ($dias <= 0) {
        return 'hoje';
    }
    return $dias === 1 ? 'amanhã' : 'em ' . $dias . ' dias';
}

function data_valida($valor): bool
{
    return is_string($valor) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor) === 1;
}

function ja_enviado(int $usuarioId, string $chave): bool
{
    return consultar('SELECT 1 FROM lembretes_enviados WHERE usuario_id = ? AND chave = ?', [$usuarioId, $chave])->fetchColumn() !== false;
}

function marcar_enviado(int $usuarioId, string $chave): void
{
    consultar('INSERT INTO lembretes_enviados (usuario_id, chave, enviado_em) VALUES (?, ?, ?)', [$usuarioId, mb_substr($chave, 0, 100), agora()]);
}

// Junta os avisos de cada pessoa num e-mail só
$avisos = [];

/* --- Alimentação: o que está acabando ---------------------------------------------------- */

$linhas = consultar(
    'SELECT a.usuario_id, a.dados FROM alimentacao a JOIN usuarios u ON u.id = a.usuario_id WHERE u.email_verificado = 1'
)->fetchAll();
foreach ($linhas as $linha) {
    $dados = json_decode((string) $linha['dados'], true);
    if (!is_array($dados) || ($dados['lembretes'] ?? false) !== true) {
        continue;
    }
    $itens = $dados['resumoLista']['itens'] ?? [];
    if (!is_array($itens)) {
        continue;
    }
    $id = (int) $linha['usuario_id'];
    foreach ($itens as $item) {
        if (!is_array($item) || !data_valida($item['acabaEm'] ?? null) || !is_string($item['nome'] ?? null)) {
            continue;
        }
        $dias = dias_ate($hoje, $item['acabaEm']);
        if ($dias < 0 || $dias > LEMBRETE_ALIMENTO_DIAS) {
            continue;
        }
        $chave = 'alim:' . ($item['id'] ?? '') . ':' . $item['acabaEm'];
        if (ja_enviado($id, $chave)) {
            continue;
        }
        $avisos[$id]['alimentacao'][] = ['texto' => $item['nome'] . ': acaba ' . quando($dias) . ' (' . data_curta($item['acabaEm']) . ').', 'chave' => $chave];
    }
}

/* --- Ocasiões: encomenda e evento chegando -------------------------------------------------- */

$linhas = consultar(
    "SELECT d.usuario_id, d.dados FROM apps_dados d JOIN usuarios u ON u.id = d.usuario_id WHERE d.app = 'ocasioes' AND u.email_verificado = 1"
)->fetchAll();
foreach ($linhas as $linha) {
    $dados = json_decode((string) $linha['dados'], true);
    if (!is_array($dados) || ($dados['lembretes'] ?? false) !== true || !is_array($dados['eventos'] ?? null)) {
        continue;
    }
    $id = (int) $linha['usuario_id'];
    foreach ($dados['eventos'] as $evento) {
        if (!is_array($evento) || !data_valida($evento['data'] ?? null)) {
            continue;
        }
        $nome = is_string($evento['nome'] ?? null) && $evento['nome'] !== '' ? $evento['nome'] : 'Seu evento';
        $codigo = is_string($evento['id'] ?? null) ? $evento['id'] : '';
        $ate = $evento['encomendarAte'] ?? '';
        if (data_valida($ate) && ($evento['encomendado'] ?? false) !== true) {
            $dias = dias_ate($hoje, $ate);
            $chave = 'oc-enc:' . $codigo . ':' . $ate;
            if ($dias >= 0 && $dias <= LEMBRETE_ENCOMENDA_DIAS && !ja_enviado($id, $chave)) {
                $avisos[$id]['ocasioes'][] = ['texto' => $nome . ' (' . data_curta($evento['data']) . '): para a peça sob medida ficar pronta, encomende ' . quando($dias) . ', até ' . data_curta($ate) . '.', 'chave' => $chave];
            }
        }
        $dias = dias_ate($hoje, $evento['data']);
        $chave = 'oc-evt:' . $codigo . ':' . $evento['data'];
        if ($dias >= 1 && $dias <= LEMBRETE_EVENTO_DIAS && !ja_enviado($id, $chave)) {
            $texto = ($evento['tipo'] ?? '') === 'viagem'
                ? $nome . ': a viagem começa ' . quando($dias) . ' (' . data_curta($evento['data']) . '). Confira a lista da mala no app.'
                : $nome . ' é ' . quando($dias) . ' (' . data_curta($evento['data']) . '). Separe o look e confira se está tudo passado e ajustado.';
            $avisos[$id]['ocasioes'][] = ['texto' => $texto, 'chave' => $chave];
        }
    }
}

/* --- Envio ------------------------------------------------------------------------------------ */

$enviados = 0;
foreach ($avisos as $id => $partes) {
    $usuario = consultar('SELECT nome, email FROM usuarios WHERE id = ?', [$id])->fetch();
    if (!$usuario) {
        continue;
    }
    $primeiroNome = trim(explode(' ', trim((string) $usuario['nome']))[0] ?? '');
    $corpo = 'Olá' . ($primeiroNome !== '' ? ', ' . $primeiroNome : '') . ".\n\n";
    $assuntos = [];
    if (!empty($partes['alimentacao'])) {
        $assuntos[] = 'lista de compras';
        $corpo .= "Da sua lista de compras:\n";
        foreach ($partes['alimentacao'] as $a) {
            $corpo .= '- ' . $a['texto'] . "\n";
        }
        $corpo .= "\nAbra a lista: " . $siteUrl . "/apps/alimentacao/\n\n";
    }
    if (!empty($partes['ocasioes'])) {
        $assuntos[] = 'suas ocasiões';
        $corpo .= "Das suas ocasiões:\n";
        foreach ($partes['ocasioes'] as $a) {
            $corpo .= '- ' . $a['texto'] . "\n";
        }
        $corpo .= "\nVeja os detalhes: " . $siteUrl . "/apps/ocasioes/\n\n";
    }
    $corpo .= "Para não receber mais estes avisos, desligue a opção \"Me avise por e-mail\" no app.\n\nRauber";
    $assunto = 'Lembrete: ' . implode(' e ', $assuntos);
    if (enviar_email((string) $usuario['email'], $assunto, $corpo)) {
        foreach ($partes as $lista) {
            foreach ($lista as $a) {
                marcar_enviado((int) $id, $a['chave']);
            }
        }
        $enviados += 1;
    }
}

// Avisos com mais de 4 meses já não se repetem
consultar('DELETE FROM lembretes_enviados WHERE enviado_em < ?', [date('Y-m-d H:i:s', time() - 120 * 86400)]);

echo 'Lembretes enviados: ' . $enviados . "\n";
