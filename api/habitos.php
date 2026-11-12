<?php
/**
 * Hábitos: os lembretes no navegador.
 *
 * GET  ?acao=chave       a chave pública para o navegador se inscrever, e quando a tarefa do Cron rodou
 * POST ?acao=inscrever   guarda o endereço de notificação deste aparelho  {endpoint, keys: {p256dh, auth}}
 * POST ?acao=cancelar    apaga o endereço deste aparelho                 {endpoint}
 * GET  ?acao=avisos      os avisos ainda não mostrados (o sw.js pede ao receber o toque)
 * POST ?acao=testar      manda um aviso de teste para os aparelhos da pessoa  {atraso: 0 ou 20 segundos}
 *
 * Os hábitos em si ficam em api/apps.php?app=habitos, com a autorização da pessoa.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// Com a cobrança ligada no painel, só quem assina usa os apps
exigir_acesso_apps(['cancelar', 'avisos']);
require __DIR__ . '/push.php';

const PUSH_MAXIMO_APARELHOS = 10;

header('Cache-Control: no-store');

switch ($_GET['acao'] ?? '') {
    case 'chave':
        exigir_login();
        $rodou = (int) ajuste('tarefa_habitos_em', 0);
        responder(200, ['chave' => chaves_vapid()['publica'], 'tarefaMinutos' => $rodou > 0 ? (int) floor((time() - $rodou) / 60) : null]);
        break;

    case 'inscrever':
        $dados = exigir_post();
        $usuario = exigir_login();
        $id = (int) $usuario['id'];
        $limite = chave_limite('push-inscrever', (string) $id);
        exigir_limite($limite, 30, 3600);
        contar_tentativa($limite);
        $endereco = $dados['endpoint'] ?? null;
        if (!endereco_de_push_valido($endereco)) {
            falhar(422, 'Este navegador não é aceito para lembretes.');
        }
        $hash = hash('sha256', $endereco);
        consultar('DELETE FROM push_inscricoes WHERE endpoint_hash = ?', [$hash]);
        consultar(
            'INSERT INTO push_inscricoes (usuario_id, endpoint, endpoint_hash, criado_em) VALUES (?, ?, ?, ?)',
            [$id, $endereco, $hash, agora()]
        );
        // As chaves do navegador: com elas o aviso vai dentro da notificação
        $chaves = is_array($dados['keys'] ?? null) ? $dados['keys'] : [];
        try {
            consultar('DELETE FROM push_chaves WHERE endpoint_hash = ?', [$hash]);
            if (chaves_do_navegador_validas($chaves['p256dh'] ?? null, $chaves['auth'] ?? null)) {
                consultar('INSERT INTO push_chaves (endpoint_hash, p256dh, auth, criado_em) VALUES (?, ?, ?, ?)', [$hash, $chaves['p256dh'], $chaves['auth'], agora()]);
            }
        } catch (PDOException $erro) {
            // Banco ainda sem a tabela das chaves: o aparelho recebe o toque vazio, como antes
        }
        // Aparelhos demais: sai o mais antigo
        $ids = consultar('SELECT id FROM push_inscricoes WHERE usuario_id = ? ORDER BY id DESC', [$id])->fetchAll(PDO::FETCH_COLUMN);
        foreach (array_slice($ids, PUSH_MAXIMO_APARELHOS) as $velho) {
            consultar('DELETE FROM push_inscricoes WHERE id = ?', [$velho]);
        }
        responder(200, ['aparelhos' => min(count($ids), PUSH_MAXIMO_APARELHOS)]);
        break;

    case 'cancelar':
        $dados = exigir_post();
        $usuario = exigir_login();
        $endereco = $dados['endpoint'] ?? null;
        if (is_string($endereco)) {
            $hash = hash('sha256', $endereco);
            if (consultar('DELETE FROM push_inscricoes WHERE usuario_id = ? AND endpoint_hash = ?', [(int) $usuario['id'], $hash])->rowCount() > 0) {
                try {
                    consultar('DELETE FROM push_chaves WHERE endpoint_hash = ?', [$hash]);
                } catch (PDOException $erro) {
                    // Sem a tabela das chaves, não há o que apagar
                }
            }
        }
        responder(200);
        break;

    case 'avisos':
        // Sem conta conectada, o sw.js mostra um aviso genérico
        $usuario = usuario_logado();
        if (!$usuario) {
            responder(200, ['avisos' => []]);
        }
        $id = (int) $usuario['id'];
        $desde = date('Y-m-d H:i:s', time() - 12 * 3600);
        $linhas = consultar(
            'SELECT id, titulo, texto, marca FROM avisos_push WHERE usuario_id = ? AND entregue_em IS NULL AND criado_em >= ? ORDER BY id DESC LIMIT 3',
            [$id, $desde]
        )->fetchAll();
        foreach ($linhas as $l) {
            consultar('UPDATE avisos_push SET entregue_em = ? WHERE id = ?', [agora(), $l['id']]);
        }
        // Avisos antigos não servem para nada
        consultar('DELETE FROM avisos_push WHERE usuario_id = ? AND criado_em < ?', [$id, date('Y-m-d H:i:s', time() - 7 * 86400)]);
        responder(200, ['avisos' => array_map(function (array $l): array {
            return ['titulo' => $l['titulo'], 'texto' => $l['texto'], 'marca' => $l['marca'], 'url' => '/apps/habitos/'];
        }, $linhas)]);
        break;

    case 'testar':
        $dados = exigir_post();
        $usuario = exigir_login();
        $id = (int) $usuario['id'];
        $limite = chave_limite('push-testar', (string) $id);
        exigir_limite($limite, 6, 3600);
        contar_tentativa($limite);
        if (!consultar('SELECT 1 FROM push_inscricoes WHERE usuario_id = ?', [$id])->fetchColumn()) {
            falhar(409, 'Nenhum aparelho com lembretes. Ative os lembretes neste aparelho e tente de novo.');
        }
        if ((int) ($dados['atraso'] ?? 0) > 0) {
            // Teste com o site fechado: responde já e manda daqui a 20 segundos
            $resposta = json_encode(['ok' => true, 'atraso' => 20]);
            ignore_user_abort(true);
            set_time_limit(90);
            http_response_code(200);
            header('Content-Length: ' . strlen($resposta));
            header('Connection: close');
            echo $resposta;
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            flush();
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            }
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }
            sleep(20);
            avisar_por_push($id, 'Chegou com o site fechado', 'Os seus lembretes vão chegar assim, mesmo sem o Rauber aberto.', 'teste');
            exit;
        }
        $aceitos = avisar_por_push($id, 'Lembretes ligados', 'É assim que os seus hábitos vão chamar você. Pode fechar o navegador.', 'teste');
        if ($aceitos === 0) {
            falhar(409, 'Nenhum aparelho recebeu. Ative os lembretes neste aparelho e tente de novo.');
        }
        responder(200, ['aparelhos' => $aceitos]);
        break;

    default:
        falhar(404, 'Ação desconhecida.');
}
