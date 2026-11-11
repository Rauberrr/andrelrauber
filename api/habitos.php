<?php
/**
 * Hábitos: os lembretes no navegador.
 *
 * GET  ?acao=chave       a chave pública para o navegador se inscrever
 * POST ?acao=inscrever   guarda o endereço de notificação deste aparelho  {endpoint}
 * POST ?acao=cancelar    apaga o endereço deste aparelho                 {endpoint}
 * GET  ?acao=avisos      os avisos ainda não mostrados (o sw.js pede ao receber o toque)
 * POST ?acao=testar      manda um aviso de teste para os aparelhos da pessoa
 *
 * Os hábitos em si ficam em api/apps.php?app=habitos, com a autorização da pessoa.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/push.php';

const PUSH_MAXIMO_APARELHOS = 10;

header('Cache-Control: no-store');

switch ($_GET['acao'] ?? '') {
    case 'chave':
        exigir_login();
        responder(200, ['chave' => chaves_vapid()['publica']]);
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
            consultar('DELETE FROM push_inscricoes WHERE usuario_id = ? AND endpoint_hash = ?', [(int) $usuario['id'], hash('sha256', $endereco)]);
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
        exigir_post();
        $usuario = exigir_login();
        $id = (int) $usuario['id'];
        $limite = chave_limite('push-testar', (string) $id);
        exigir_limite($limite, 6, 3600);
        contar_tentativa($limite);
        if (!consultar('SELECT 1 FROM push_inscricoes WHERE usuario_id = ?', [$id])->fetchColumn()) {
            falhar(409, 'Nenhum aparelho com lembretes. Ative os lembretes neste aparelho e tente de novo.');
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
