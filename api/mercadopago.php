<?php
/**
 * Conversa com o Mercado Pago e atualiza a situação dos pedidos.
 *
 * Um pedido só vira "pago" depois de o site consultar o pagamento no próprio
 * Mercado Pago. O que chega por aviso ou pela volta do cliente nunca é aceito
 * como prova de pagamento.
 */
declare(strict_types=1);

if (!defined('AR_API')) {
    http_response_code(403);
    exit;
}

const MP_ENDERECO = 'https://api.mercadopago.com';

function mp_ativo(): bool
{
    return trim((string) (config()['mercadopago_token'] ?? '')) !== '';
}

// Devolve os dados da resposta, ou null se o Mercado Pago não respondeu como esperado
function mp_pedir(string $metodo, string $caminho, ?array $corpo = null): ?array
{
    $c = config();
    $base = rtrim((string) ($c['mercadopago_base'] ?? MP_ENDERECO), '/');
    $cabecalhos = ['Authorization: Bearer ' . trim((string) ($c['mercadopago_token'] ?? '')), 'Accept: application/json'];
    $json = null;
    if ($corpo !== null) {
        $json = json_encode($corpo, JSON_UNESCAPED_UNICODE);
        $cabecalhos[] = 'Content-Type: application/json';
    }

    if (function_exists('curl_init')) {
        $curl = curl_init($base . $caminho);
        $opcoes = [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_CUSTOMREQUEST => $metodo, CURLOPT_HTTPHEADER => $cabecalhos,
        ];
        if ($json !== null) {
            $opcoes[CURLOPT_POSTFIELDS] = $json;
        }
        curl_setopt_array($curl, $opcoes);
        $resposta = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
    } else {
        $contexto = stream_context_create(['http' => [
            'method' => $metodo, 'header' => implode("\r\n", $cabecalhos), 'content' => (string) $json,
            'timeout' => 15, 'ignore_errors' => true,
        ]]);
        $resposta = @file_get_contents($base . $caminho, false, $contexto);
        $status = 0;
        foreach ($http_response_header ?? [] as $linha) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $linha, $partes) === 1) {
                $status = (int) $partes[1];
            }
        }
    }

    if (!is_string($resposta) || $status < 200 || $status >= 300) {
        // O token não entra no registro: só o caminho e o código da resposta
        error_log('Andre Rauber: Mercado Pago respondeu ' . $status . ' em ' . strtok($caminho, '?'));
        return null;
    }
    $dados = json_decode($resposta, true);
    return is_array($dados) ? $dados : null;
}

function mp_endereco_do_site(): string
{
    return rtrim((string) (config()['site_url'] ?? ''), '/');
}

function pedido_total(array $pedido): int
{
    return (int) $pedido['valor_centavos'] + (int) $pedido['frete_centavos'];
}

// Devolve o endereço da tela de pagamento. O valor sai sempre do banco, nunca do navegador.
function mp_criar_cobranca(array $pedido, array $usuario): ?string
{
    $itens = [[
        'id' => 'pedido-' . (int) $pedido['id'],
        'title' => (string) $pedido['descricao'],
        'quantity' => 1,
        'currency_id' => 'BRL',
        'unit_price' => (int) $pedido['valor_centavos'] / 100,
    ]];
    if ((int) $pedido['frete_centavos'] > 0) {
        $itens[] = [
            'id' => 'frete',
            'title' => 'Frete',
            'quantity' => 1,
            'currency_id' => 'BRL',
            'unit_price' => (int) $pedido['frete_centavos'] / 100,
        ];
    }

    $site = mp_endereco_do_site();
    $volta = $site . '/minha-conta.html?pedido=' . $pedido['codigo'] . '&pagamento=';
    $cobranca = [
        'items' => $itens,
        'external_reference' => (string) $pedido['codigo'],
        'statement_descriptor' => 'ANDRERAUBER',
        'payer' => ['name' => (string) $usuario['nome'], 'email' => (string) $usuario['email']],
        'back_urls' => ['success' => $volta . 'aprovado', 'pending' => $volta . 'pendente', 'failure' => $volta . 'recusado'],
    ];
    // O retorno automático só funciona com o endereço público do site
    if (strpos($site, 'https://') === 0) {
        $cobranca['auto_return'] = 'approved';
    }
    // Só Pix e cartão: o boleto demora a compensar e seguraria o início da confecção
    $cobranca['payment_methods'] = ['excluded_payment_types' => [['id' => 'ticket'], ['id' => 'atm']]];
    $maximo = (int) (config()['mercadopago_parcelas'] ?? 0);
    if ($maximo >= 1 && $maximo <= 36) {
        $cobranca['payment_methods']['installments'] = $maximo;
    }

    $resposta = mp_pedir('POST', '/checkout/preferences', $cobranca);
    $link = is_array($resposta) ? (string) ($resposta['init_point'] ?? '') : '';
    return strpos($link, 'http') === 0 ? $link : null;
}

function mp_consultar_pagamento(string $id): ?array
{
    if (preg_match('/^\d{1,30}$/', $id) !== 1) {
        return null;
    }
    return mp_pedir('GET', '/v1/payments/' . $id);
}

// Plano B do aviso: procura os pagamentos do pedido no Mercado Pago
function mp_conferir_pedido(string $codigo): void
{
    $resposta = mp_pedir('GET', '/v1/payments/search?' . http_build_query([
        'sort' => 'date_created', 'criteria' => 'asc', 'external_reference' => $codigo,
        'range' => 'date_created', 'begin_date' => 'NOW-180DAYS', 'end_date' => 'NOW',
    ]));
    if ($resposta === null) {
        return;
    }
    // A documentação mostra a resposta ora como objeto, ora dentro de uma lista
    $bloco = isset($resposta['results']) ? $resposta : ($resposta[0] ?? []);
    foreach ($bloco['results'] ?? [] as $pagamento) {
        if (is_array($pagamento)) {
            mp_aplicar_pagamento($pagamento);
        }
    }
}

function pedido_atualizar(array $pedido, string $situacao, array $pagamento = []): int
{
    return consultar(
        'UPDATE pedidos SET situacao = ?, mp_pagamento_id = ?, metodo = ?, parcelas = ?, atualizado_em = ? WHERE id = ? AND situacao = ?',
        [
            $situacao,
            isset($pagamento['id']) ? (string) $pagamento['id'] : (string) $pedido['mp_pagamento_id'],
            mb_substr((string) ($pagamento['payment_type_id'] ?? $pedido['metodo']), 0, 30, 'UTF-8'),
            (int) ($pagamento['installments'] ?? $pedido['parcelas']),
            agora(),
            $pedido['id'],
            $pedido['situacao'],
        ]
    )->rowCount();
}

function avisar_dono(string $assunto, string $corpo): void
{
    $para = (string) (config()['email_aviso'] ?? '');
    if ($para !== '') {
        enviar_email($para, $assunto, $corpo);
    }
}

function reais(int $centavos): string
{
    return 'R$ ' . number_format($centavos / 100, 2, ',', '.');
}

// Aplica ao pedido o que o Mercado Pago informou. Avisos repetidos ou fora de ordem não mudam o resultado.
function mp_aplicar_pagamento(array $pagamento): void
{
    $codigo = (string) ($pagamento['external_reference'] ?? '');
    if (preg_match('/^[a-f0-9]{32}$/', $codigo) !== 1) {
        return;
    }
    $pedido = consultar('SELECT * FROM pedidos WHERE codigo = ?', [$codigo])->fetch();
    if (!$pedido) {
        return;
    }
    $id = (string) ($pagamento['id'] ?? '');
    $mesmo = $id !== '' && $id === (string) $pedido['mp_pagamento_id'];
    $status = (string) ($pagamento['status'] ?? '');
    $usuarioId = (int) $pedido['usuario_id'];
    $titulo = '"' . $pedido['descricao'] . '"';

    switch ($status) {
        case 'approved':
            mp_aprovar($pedido, $pagamento, $id, $mesmo);
            return;
        case 'refunded':
        case 'charged_back':
            if ($mesmo && pedido_atualizar($pedido, 'estornado', $pagamento) === 1) {
                registrar_evento($usuarioId, 'pagamento_estornado', null, (string) $pedido['descricao']);
                avisar_dono('Pagamento estornado no site', 'O pagamento do pedido ' . $titulo . ' foi estornado ou contestado e devolvido. Confira no painel e no Mercado Pago.');
            }
            return;
        case 'in_mediation':
            if ($mesmo && pedido_atualizar($pedido, 'contestado', $pagamento) === 1) {
                registrar_evento($usuarioId, 'pagamento_contestado', null, (string) $pedido['descricao']);
                avisar_dono('Pagamento contestado no site', 'O pagamento do pedido ' . $titulo . ' está em disputa. Responda pelo Mercado Pago.');
            }
            return;
        case 'pending':
        case 'in_process':
        case 'authorized':
        case 'action_required':
            if ($pedido['situacao'] === 'aguardando' && pedido_atualizar($pedido, 'processando', $pagamento) === 1) {
                registrar_evento($usuarioId, 'pagamento_iniciado', null, (string) $pedido['descricao']);
            }
            return;
        case 'rejected':
        case 'cancelled':
            // Volta a aceitar pagamento, sem mexer em um pedido já pago por outra tentativa
            if ($mesmo && $pedido['situacao'] === 'processando') {
                pedido_atualizar($pedido, 'aguardando');
            }
            return;
    }
}

function mp_aprovar(array $pedido, array $pagamento, string $id, bool $mesmo): void
{
    $usuarioId = (int) $pedido['usuario_id'];
    $titulo = '"' . $pedido['descricao'] . '"';
    $total = pedido_total($pedido);

    if ($pedido['situacao'] === 'pago') {
        // O cliente pagou duas vezes: precisa de estorno manual
        if (!$mesmo) {
            $jaAvisado = consultar(
                "SELECT COUNT(*) FROM eventos WHERE usuario_id = ? AND tipo = 'pagamento_duplicado' AND detalhes = ?",
                [$usuarioId, $id]
            )->fetchColumn();
            if ((int) $jaAvisado === 0) {
                registrar_evento($usuarioId, 'pagamento_duplicado', null, $id);
                avisar_dono('Pagamento em duplicidade no site', 'O pedido ' . $titulo . ' recebeu um segundo pagamento (número ' . $id . '). Faça o estorno pelo Mercado Pago.');
            }
        }
        return;
    }

    // Só aceita o valor certo, em reais: o valor do pedido é conferido no próprio Mercado Pago
    $pago = (int) round(((float) ($pagamento['transaction_amount'] ?? 0)) * 100);
    if (($pagamento['currency_id'] ?? '') !== 'BRL' || $pago < $total) {
        $jaAvisado = consultar(
            "SELECT COUNT(*) FROM eventos WHERE usuario_id = ? AND tipo = 'pagamento_divergente' AND detalhes = ?",
            [$usuarioId, $id]
        )->fetchColumn();
        if ((int) $jaAvisado === 0) {
            registrar_evento($usuarioId, 'pagamento_divergente', null, $id);
            avisar_dono('Pagamento com valor diferente no site', 'O pagamento ' . $id . ' do pedido ' . $titulo . ' veio com valor diferente de ' . reais($total) . '. O pedido não foi marcado como pago. Confira no Mercado Pago.');
        }
        return;
    }

    $mudou = consultar(
        "UPDATE pedidos SET situacao = 'pago', mp_pagamento_id = ?, metodo = ?, parcelas = ?, pago_em = ?, atualizado_em = ? WHERE id = ? AND situacao <> 'pago'",
        [$id, mb_substr((string) ($pagamento['payment_type_id'] ?? ''), 0, 30, 'UTF-8'), (int) ($pagamento['installments'] ?? 1), agora(), agora(), $pedido['id']]
    )->rowCount();
    if ($mudou !== 1) {
        return;
    }

    registrar_evento($usuarioId, 'pagamento_aprovado', null, (string) $pedido['descricao']);
    $extra = $pedido['situacao'] === 'cancelado' ? ' Atenção: este pedido estava cancelado.' : '';
    avisar_dono('Pagamento aprovado no site', 'O pedido ' . $titulo . ' foi pago: ' . reais($total) . '.' . $extra . ' Veja em ' . mp_endereco_do_site() . '/painel.html');
    $usuario = consultar('SELECT email FROM usuarios WHERE id = ?', [$usuarioId])->fetch();
    if ($usuario) {
        enviar_email((string) $usuario['email'], 'Recebemos seu pagamento', 'Recebemos o pagamento do seu pedido ' . $titulo . ', no valor de ' . reais($total) . '. Vamos falar com você sobre os próximos passos da confecção.');
    }
}

// Confere a assinatura que o Mercado Pago coloca em cada aviso
function mp_assinatura_valida(string $cabecalho, string $requestId, string $dadoId, string $segredo): bool
{
    $partes = [];
    foreach (explode(',', $cabecalho) as $pedaco) {
        $par = explode('=', trim($pedaco), 2);
        if (count($par) === 2) {
            $partes[$par[0]] = $par[1];
        }
    }
    $ts = $partes['ts'] ?? '';
    $v1 = $partes['v1'] ?? '';
    if ($ts === '' || $v1 === '' || $segredo === '') {
        return false;
    }
    $modelo = '';
    if ($dadoId !== '') {
        $modelo .= 'id:' . strtolower($dadoId) . ';';
    }
    if ($requestId !== '') {
        $modelo .= 'request-id:' . $requestId . ';';
    }
    $modelo .= 'ts:' . $ts . ';';
    return hash_equals(hash_hmac('sha256', $modelo, $segredo), $v1);
}

/* --- Assinatura dos apps (cobrança mensal automática, "preapproval") ----------------------------
   O site cria a assinatura no Mercado Pago e manda a pessoa para a tela de lá, onde ela
   cadastra o cartão. Depois, o acesso só muda pelo que o site consulta no próprio Mercado Pago:
   o aviso e a volta da pessoa servem só para disparar a consulta. */

// Dias de folga depois da data da próxima cobrança, para o Mercado Pago tentar de novo
const MP_ASSINATURA_FOLGA_DIAS = 3;

function mp_id_valido(string $id): bool
{
    return preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id) === 1;
}

/**
 * Cria a assinatura e devolve o endereço da tela do Mercado Pago, ou null.
 * $primeiraCobranca: quem assina durante o teste grátis só paga quando o teste acaba.
 */
function mp_criar_assinatura(array $usuario, array $plano, ?string $primeiraCobranca = null): ?string
{
    $site = mp_endereco_do_site();
    $recorrencia = [
        'frequency' => 1,
        'frequency_type' => 'months',
        'transaction_amount' => (int) $plano['precoCentavos'] / 100,
        'currency_id' => 'BRL',
    ];
    if ($primeiraCobranca !== null && strtotime($primeiraCobranca) > time()) {
        $recorrencia['start_date'] = date('Y-m-d\TH:i:s.000P', strtotime($primeiraCobranca));
    }
    $resposta = mp_pedir('POST', '/preapproval', [
        'reason' => mb_substr((string) $plano['nome'], 0, 60) . ' (mensal)',
        'external_reference' => 'assinatura-' . (int) $usuario['id'],
        'payer_email' => (string) $usuario['email'],
        'auto_recurring' => $recorrencia,
        'back_url' => $site . '/assinatura.html?assinatura=voltou',
        'status' => 'pending',
    ]);
    if (!is_array($resposta) || !mp_id_valido((string) ($resposta['id'] ?? '')) || strpos((string) ($resposta['init_point'] ?? ''), 'http') !== 0) {
        return null;
    }
    $momento = agora();
    consultar('DELETE FROM assinaturas_mp WHERE usuario_id = ? AND status = ?', [(int) $usuario['id'], 'pending']);
    consultar(
        'INSERT INTO assinaturas_mp (preapproval_id, usuario_id, status, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)',
        [(string) $resposta['id'], (int) $usuario['id'], 'pending', $momento, $momento]
    );
    return (string) $resposta['init_point'];
}

/**
 * Consulta a assinatura no Mercado Pago e ajusta o acesso da pessoa.
 * authorized: libera até a próxima cobrança (mais a folga). cancelled ou paused: o acesso
 * continua até o fim do mês que já foi pago e depois acaba. Devolve false se não conseguiu consultar.
 */
function mp_sincronizar_assinatura(string $id): bool
{
    if (!mp_id_valido($id)) {
        return true;
    }
    $linha = consultar('SELECT * FROM assinaturas_mp WHERE preapproval_id = ?', [$id])->fetch();
    if (!$linha) {
        // Assinatura que não foi criada por este site: nada a fazer
        return true;
    }
    $pre = mp_pedir('GET', '/preapproval/' . $id);
    if ($pre === null) {
        return false;
    }
    $usuarioId = (int) $linha['usuario_id'];
    // Confere que é mesmo a assinatura desta pessoa
    if ((string) ($pre['external_reference'] ?? '') !== 'assinatura-' . $usuarioId) {
        return true;
    }
    $status = in_array($pre['status'] ?? '', ['pending', 'authorized', 'paused', 'cancelled'], true) ? $pre['status'] : 'pending';
    $momento = agora();
    consultar('UPDATE assinaturas_mp SET status = ?, atualizado_em = ? WHERE preapproval_id = ?', [$status, $momento, $id]);
    $atual = consultar('SELECT * FROM assinaturas WHERE usuario_id = ?', [$usuarioId])->fetch();
    if ($status === 'authorized') {
        $proxima = strtotime((string) ($pre['next_payment_date'] ?? '')) ?: time() + 31 * 86400;
        $ate = date('Y-m-d H:i:s', $proxima + MP_ASSINATURA_FOLGA_DIAS * 86400);
        if ($atual) {
            consultar("UPDATE assinaturas SET situacao = 'ativa', valida_ate = ?, origem = 'mercadopago', atualizado_em = ? WHERE usuario_id = ?", [$ate, $momento, $usuarioId]);
        } else {
            consultar("INSERT INTO assinaturas (usuario_id, situacao, valida_ate, origem, criado_em, atualizado_em) VALUES (?, 'ativa', ?, 'mercadopago', ?, ?)", [$usuarioId, $ate, $momento, $momento]);
        }
        if ((string) $linha['status'] !== 'authorized') {
            registrar_evento($usuarioId, 'assinatura_ativa');
        }
    } elseif (($status === 'cancelled' || $status === 'paused') && $atual && $atual['origem'] === 'mercadopago') {
        // Sem prazo guardado, o acesso acaba agora
        if ($atual['valida_ate'] === null) {
            consultar('UPDATE assinaturas SET valida_ate = ?, atualizado_em = ? WHERE usuario_id = ?', [$momento, $momento, $usuarioId]);
        }
        if ((string) $linha['status'] === 'authorized') {
            registrar_evento($usuarioId, 'assinatura_cancelada');
        }
    }
    return true;
}

// O aviso de cada cobrança traz o pagamento autorizado; dele sai a assinatura
function mp_sincronizar_cobranca_da_assinatura(string $id): bool
{
    if (preg_match('/^\d{1,30}$/', $id) !== 1) {
        return true;
    }
    $cobranca = mp_pedir('GET', '/authorized_payments/' . $id);
    if ($cobranca === null) {
        return false;
    }
    return mp_sincronizar_assinatura((string) ($cobranca['preapproval_id'] ?? ''));
}

function mp_cancelar_assinatura(string $id): bool
{
    if (!mp_id_valido($id)) {
        return false;
    }
    if (mp_pedir('PUT', '/preapproval/' . $id, ['status' => 'cancelled']) === null) {
        return false;
    }
    return mp_sincronizar_assinatura($id);
}

