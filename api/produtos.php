<?php
/**
 * Coleção: produtos, coleções agendadas e pedidos exclusivos.
 *
 * GET                          produtos no ar e as próximas coleções
 * GET ?slug=x                  um produto (o gestor também vê rascunhos e coleções futuras)
 * GET ?acao=foto&f=arquivo     a foto de um produto
 * GET ?acao=gestor             tudo, para o painel (só administrador)
 * GET ?acao=meus-exclusivos    os pedidos exclusivos da pessoa na conta
 * POST ?acao=salvar            cria ou altera um produto (só administrador)
 * POST ?acao=enviar-foto       envia uma foto do produto, em multipart (só administrador)
 * POST ?acao=fotos             muda a ordem das fotos ou tira uma (só administrador)
 * POST ?acao=apagar            apaga um produto e as fotos dele (só administrador)
 * POST ?acao=colecao           cria ou altera uma coleção agendada (só administrador)
 * POST ?acao=apagar-colecao    apaga uma coleção; os produtos ficam, sem coleção (só administrador)
 * POST ?acao=exclusivo         registra um pedido exclusivo (pessoa na conta)
 * POST ?acao=exclusivo-situacao muda a situação de um pedido exclusivo (só administrador)
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// Acompanham as listas de assets/js/colecao-dados.js
const PR_CATEGORIAS = ['camiseta', 'polo', 'camisa', 'calca', 'bermuda', 'blazer', 'terno', 'colete', 'jaqueta', 'acessorio'];
const PR_MODELAGENS = ['ajustada', 'regular', 'solta'];
const PR_SITUACOES = ['rascunho', 'publicado', 'esgotado'];
const PR_MAXIMO_FOTOS = 8;
const PR_MAXIMO_BYTES = 12000000;
const PR_MAIOR_LADO = 1600;
const EX_PECAS = ['camiseta', 'polo', 'camisa', 'calca', 'bermuda', 'blazer', 'terno', 'colete', 'jaqueta'];
const EX_OCASIOES = ['dia_a_dia', 'trabalho', 'evento', 'casamento', 'viagem', 'outra'];
const EX_TECIDOS = ['malha_algodao', 'piquet', 'algodao', 'tricoline', 'oxford', 'linho', 'sarja', 'la_fria', 'gabardine', 'viscose', 'indicacao'];
const EX_CAIMENTOS = ['ajustada', 'regular', 'solta'];
const EX_ORCAMENTOS = ['ate_300', 'ate_600', 'ate_1200', 'acima_1200', 'a_definir'];
const EX_SITUACOES = ['novo', 'conversando', 'orcado', 'fechado', 'cancelado'];

$metodo = $_SERVER['REQUEST_METHOD'] ?? '';
$acao = $_GET['acao'] ?? '';

if ($metodo === 'GET') {
    if ($acao === 'foto') {
        entregar_foto();
    } elseif ($acao === 'gestor') {
        gestor();
    } elseif ($acao === 'meus-exclusivos') {
        meus_exclusivos();
    } elseif (isset($_GET['slug'])) {
        um_produto();
    } else {
        vitrine();
    }
}

switch ($acao) {
    case 'salvar':
        salvar_produto();
        break;
    case 'enviar-foto':
        enviar_foto();
        break;
    case 'fotos':
        mudar_fotos();
        break;
    case 'apagar':
        apagar_produto();
        break;
    case 'colecao':
        salvar_colecao();
        break;
    case 'apagar-colecao':
        apagar_colecao();
        break;
    case 'exclusivo':
        pedir_exclusivo();
        break;
    case 'exclusivo-situacao':
        situacao_exclusivo();
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

/* --- Apoio ----------------------------------------------------------------------------------- */

function exigir_gestor(): array
{
    $usuario = exigir_login();
    if ((int) $usuario['admin'] !== 1) {
        falhar(403, 'Sem permissão.');
    }
    return $usuario;
}

function eh_gestor(): bool
{
    $usuario = usuario_logado();
    return $usuario !== null && (int) $usuario['admin'] === 1;
}

function lista_json(?string $valor): array
{
    $lista = json_decode((string) $valor, true);
    return is_array($lista) ? $lista : [];
}

// "1.290,00", "1290" ou "1290,5" viram centavos
function centavos(string $valor): ?int
{
    $valor = trim(str_ireplace('r$', '', $valor));
    if (preg_match('/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/', $valor) === 1) {
        $valor = str_replace('.', '', $valor);
    }
    $valor = str_replace(',', '.', $valor);
    if (preg_match('/^\d{1,7}(\.\d{1,2})?$/', $valor) !== 1) {
        return null;
    }
    return (int) round((float) $valor * 100);
}

function pasta_fotos_produtos(): string
{
    $pasta = __DIR__ . '/fotos-produtos';
    if (!is_dir($pasta) && !mkdir($pasta, 0755, true) && !is_dir($pasta)) {
        throw new RuntimeException('Não foi possível criar a pasta de fotos dos produtos.');
    }
    // As fotos saem por esta página, que confere o nome do arquivo
    $bloqueio = $pasta . '/.htaccess';
    if (!is_file($bloqueio)) {
        file_put_contents($bloqueio, "Require all denied\n");
    }
    return $pasta;
}

function slug_de(string $nome): string
{
    $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nome);
    $s = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', (string) $s));
    $s = trim($s, '-');
    return $s !== '' ? substr($s, 0, 70) : 'produto';
}

function slug_livre(string $base, int $id): string
{
    $slug = $base;
    $n = 2;
    while (consultar('SELECT id FROM produtos WHERE slug = ? AND id <> ?', [$slug, $id])->fetch()) {
        $slug = substr($base, 0, 66) . '-' . $n;
        $n++;
    }
    return $slug;
}

// Um produto aparece quando está publicado ou esgotado e a coleção dele, se houver, já foi lançada
function visivel(array $p): bool
{
    if (!in_array($p['situacao'], ['publicado', 'esgotado'], true)) {
        return false;
    }
    return $p['colecao_id'] === null || $p['lanca_em'] === null || $p['lanca_em'] <= agora();
}

function produto_publico(array $p, bool $completo): array
{
    $fotos = array_values(array_filter(lista_json($p['fotos']), 'is_string'));
    $dados = [
        'id' => (int) $p['id'],
        'slug' => $p['slug'],
        'nome' => $p['nome'],
        'categoria' => $p['categoria'],
        'resumo' => $p['resumo'],
        'precoCentavos' => (int) $p['preco_centavos'],
        'freteCentavos' => (int) $p['frete_centavos'],
        'situacao' => $p['situacao'],
        'fotos' => array_map(function ($f) { return 'api/produtos.php?acao=foto&f=' . $f; }, $fotos),
        'cores' => lista_json($p['cores']),
    ];
    if ($completo) {
        $dados += [
            'descricao' => $p['descricao'],
            'tecido' => $p['tecido'],
            'composicao' => $p['composicao'],
            'gramatura' => $p['gramatura'],
            'modelagem' => $p['modelagem'],
            'detalhes' => lista_json($p['detalhes']),
            'cuidados' => $p['cuidados'],
            'prazoDias' => (int) $p['prazo_dias'],
            'colecaoId' => $p['colecao_id'] === null ? null : (int) $p['colecao_id'],
            'ordem' => (int) $p['ordem'],
            'arquivos' => $fotos,
            'lancaEm' => $p['lanca_em'],
        ];
    }
    return $dados;
}

function produtos_com_colecao(string $onde = '', array $valores = []): array
{
    return consultar(
        'SELECT p.*, c.lanca_em, c.nome AS colecao_nome FROM produtos p LEFT JOIN colecoes c ON c.id = p.colecao_id ' . $onde .
        ' ORDER BY p.ordem ASC, p.id DESC',
        $valores
    )->fetchAll();
}

/* --- Vitrine ----------------------------------------------------------------------------------- */

function vitrine(): void
{
    $produtos = array_values(array_filter(produtos_com_colecao(), 'visivel'));
    $proximas = consultar(
        "SELECT c.id, c.nome, c.descricao, c.lanca_em,
                (SELECT COUNT(*) FROM produtos p WHERE p.colecao_id = c.id AND p.situacao IN ('publicado', 'esgotado')) AS total
         FROM colecoes c WHERE c.lanca_em > ? ORDER BY c.lanca_em ASC LIMIT 3",
        [agora()]
    )->fetchAll();
    header('Cache-Control: no-store');
    responder(200, [
        'produtos' => array_map(function ($p) { return produto_publico($p, false); }, $produtos),
        'proximas' => array_map(function ($c) {
            return ['nome' => $c['nome'], 'descricao' => $c['descricao'], 'lancaEm' => $c['lanca_em'], 'total' => (int) $c['total']];
        }, $proximas),
        'agora' => agora(),
    ]);
}

function um_produto(): void
{
    $slug = (string) $_GET['slug'];
    if (preg_match('/^[a-z0-9-]{1,90}$/', $slug) !== 1) {
        falhar(404, 'Produto não encontrado.');
    }
    $lista = produtos_com_colecao('WHERE p.slug = ?', [$slug]);
    $p = $lista[0] ?? null;
    $gestor = eh_gestor();
    if (!$p || (!visivel($p) && !$gestor)) {
        falhar(404, 'Produto não encontrado.');
    }
    responder(200, ['produto' => produto_publico($p, true), 'previa' => !visivel($p)]);
}

function entregar_foto(): void
{
    $arquivo = (string) ($_GET['f'] ?? '');
    if (preg_match('/^[a-f0-9]{32}\.(webp|jpg|png)$/', $arquivo, $partes) !== 1) {
        falhar(404, 'Foto não encontrada.');
    }
    $caminho = pasta_fotos_produtos() . '/' . $arquivo;
    if (!is_file($caminho)) {
        falhar(404, 'Foto não encontrada.');
    }
    $tipos = ['webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg'];
    header('Content-Type: ' . $tipos[$partes[1]]);
    header('Content-Length: ' . filesize($caminho));
    // O nome muda a cada foto nova, então dá para guardar por bastante tempo
    header('Cache-Control: public, max-age=2592000, immutable');
    header("Content-Security-Policy: default-src 'none'");
    readfile($caminho);
    exit;
}

/* --- Painel ------------------------------------------------------------------------------------ */

function gestor(): void
{
    exigir_gestor();
    $produtos = produtos_com_colecao();
    $colecoes = consultar(
        'SELECT c.*, (SELECT COUNT(*) FROM produtos p WHERE p.colecao_id = c.id) AS total FROM colecoes c ORDER BY c.lanca_em DESC'
    )->fetchAll();
    $exclusivos = consultar(
        'SELECT e.*, u.nome, u.email, u.telefone FROM pedidos_exclusivos e JOIN usuarios u ON u.id = e.usuario_id ORDER BY e.id DESC LIMIT 300'
    )->fetchAll();
    responder(200, [
        'produtos' => array_map(function ($p) { return produto_publico($p, true); }, $produtos),
        'colecoes' => array_map(function ($c) {
            return ['id' => (int) $c['id'], 'nome' => $c['nome'], 'descricao' => $c['descricao'], 'lancaEm' => $c['lanca_em'], 'total' => (int) $c['total']];
        }, $colecoes),
        'exclusivos' => array_map('exclusivo_publico', $exclusivos),
        'agora' => agora(),
    ]);
}

function exclusivo_publico(array $e): array
{
    $dados = [
        'id' => (int) $e['id'],
        'peca' => $e['peca'],
        'ocasiao' => $e['ocasiao'],
        'tecido' => $e['tecido'],
        'cor' => $e['cor'],
        'caimento' => $e['caimento'],
        'detalhes' => lista_json($e['detalhes']),
        'referencia' => $e['referencia'],
        'observacoes' => $e['observacoes'],
        'orcamento' => $e['orcamento'],
        'quantidade' => (int) $e['quantidade'],
        'prazo' => $e['prazo'],
        'situacao' => $e['situacao'],
        'criadoEm' => $e['criado_em'],
    ];
    if (isset($e['nome'])) {
        $dados['pessoa'] = ['id' => (int) $e['usuario_id'], 'nome' => $e['nome'], 'email' => $e['email'], 'telefone' => $e['telefone']];
    }
    return $dados;
}

function produto_por_id(int $id): array
{
    $p = consultar('SELECT * FROM produtos WHERE id = ?', [$id])->fetch();
    if (!$p) {
        falhar(404, 'Produto não encontrado.');
    }
    return $p;
}

function salvar_produto(): void
{
    $dados = exigir_post(200000);
    exigir_gestor();
    $id = (int) ($dados['id'] ?? 0);
    $atual = $id > 0 ? produto_por_id($id) : null;

    $erros = [];
    $nome = str_replace("\n", ' ', texto($dados, 'nome', 90));
    if (mb_strlen($nome) < 2) {
        $erros['nome'] = 'Dê um nome ao produto.';
    }
    $categoria = (string) ($dados['categoria'] ?? '');
    if (!in_array($categoria, PR_CATEGORIAS, true)) {
        $erros['categoria'] = 'Escolha a categoria.';
    }
    $preco = centavos(texto($dados, 'preco', 20));
    if ($preco === null || $preco < 100 || $preco > 10000000) {
        $erros['preco'] = 'Informe o preço, como 289,90.';
    }
    $textoFrete = texto($dados, 'frete', 20);
    $frete = $textoFrete === '' ? 0 : centavos($textoFrete);
    if ($frete === null || $frete > 100000) {
        $erros['frete'] = 'Informe o frete em reais, ou deixe em branco para frete grátis.';
    }
    $prazo = $dados['prazoDias'] ?? 20;
    if (!is_int($prazo) || $prazo < 1 || $prazo > 180) {
        $erros['prazoDias'] = 'O prazo vai de 1 a 180 dias.';
    }
    $situacao = (string) ($dados['situacao'] ?? 'rascunho');
    if (!in_array($situacao, PR_SITUACOES, true)) {
        $erros['situacao'] = 'Escolha a situação.';
    }
    $colecao = $dados['colecaoId'] ?? null;
    if ($colecao !== null && (!is_int($colecao) || !consultar('SELECT id FROM colecoes WHERE id = ?', [$colecao])->fetch())) {
        $erros['colecaoId'] = 'Esta coleção não existe mais.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }

    $cores = [];
    foreach ((is_array($dados['cores'] ?? null) ? array_slice($dados['cores'], 0, 12) : []) as $c) {
        if (!is_array($c)) {
            continue;
        }
        $nomeCor = str_replace("\n", ' ', texto($c, 'nome', 30));
        $hex = (string) ($c['hex'] ?? '');
        if ($nomeCor !== '' && preg_match('/^#[0-9a-fA-F]{6}$/', $hex) === 1) {
            $cores[] = ['nome' => $nomeCor, 'hex' => strtolower($hex)];
        }
    }
    $detalhes = [];
    foreach ((is_array($dados['detalhes'] ?? null) ? array_slice($dados['detalhes'], 0, 15) : []) as $d) {
        $linha = is_string($d) ? trim(str_replace(["\r", "\n"], ' ', mb_substr($d, 0, 120))) : '';
        if ($linha !== '') {
            $detalhes[] = $linha;
        }
    }
    $modelagem = in_array($dados['modelagem'] ?? '', PR_MODELAGENS, true) ? $dados['modelagem'] : 'regular';
    $ordem = is_int($dados['ordem'] ?? null) ? max(-999, min(999, $dados['ordem'])) : 0;
    $momento = agora();
    $valores = [
        $nome, $categoria, str_replace("\n", ' ', texto($dados, 'resumo', 200)), texto($dados, 'descricao', 3000),
        $preco, $frete, texto($dados, 'tecido', 80), texto($dados, 'composicao', 120), texto($dados, 'gramatura', 40),
        $modelagem, json_encode($cores, JSON_UNESCAPED_UNICODE), json_encode($detalhes, JSON_UNESCAPED_UNICODE),
        texto($dados, 'cuidados', 300), $prazo, $situacao, $colecao, $ordem,
    ];

    if ($atual) {
        consultar(
            'UPDATE produtos SET nome = ?, categoria = ?, resumo = ?, descricao = ?, preco_centavos = ?, frete_centavos = ?, tecido = ?,
             composicao = ?, gramatura = ?, modelagem = ?, cores = ?, detalhes = ?, cuidados = ?, prazo_dias = ?, situacao = ?,
             colecao_id = ?, ordem = ?, slug = ?, atualizado_em = ? WHERE id = ?',
            array_merge($valores, [slug_livre(slug_de($nome), $id), $momento, $id])
        );
    } else {
        consultar(
            'INSERT INTO produtos (nome, categoria, resumo, descricao, preco_centavos, frete_centavos, tecido, composicao, gramatura,
             modelagem, cores, detalhes, cuidados, prazo_dias, situacao, colecao_id, ordem, slug, fotos, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            array_merge($valores, [slug_livre(slug_de($nome), 0), '[]', $momento, $momento])
        );
        $id = (int) banco()->lastInsertId();
    }
    $p = produtos_com_colecao('WHERE p.id = ?', [$id])[0];
    responder($atual ? 200 : 201, ['produto' => produto_publico($p, true)]);
}

// A foto é regravada e reduzida: some a localização do celular e a página carrega rápido
function guardar_foto_produto(string $temporario): string
{
    $info = @getimagesize($temporario);
    $tiposAceitos = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP];
    if ($info === false || !in_array($info[2], $tiposAceitos, true)) {
        falhar(422, 'Envie uma foto em JPG, PNG ou WebP.');
    }
    if ($info[0] > 8000 || $info[1] > 8000 || min($info[0], $info[1]) < 300) {
        falhar(422, 'Use uma foto com pelo menos 300 pixels no menor lado.');
    }
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('A hospedagem não tem a biblioteca de imagens (GD).');
    }
    $original = @imagecreatefromstring((string) file_get_contents($temporario));
    if ($original === false) {
        falhar(422, 'Não foi possível abrir esta foto.');
    }
    $l = imagesx($original);
    $a = imagesy($original);
    $escala = min(1, PR_MAIOR_LADO / max($l, $a));
    $nl = (int) round($l * $escala);
    $na = (int) round($a * $escala);
    $foto = imagecreatetruecolor($nl, $na);
    imagealphablending($foto, false);
    imagesavealpha($foto, true);
    imagecopyresampled($foto, $original, 0, 0, 0, 0, $nl, $na, $l, $a);
    imagedestroy($original);

    $nome = bin2hex(random_bytes(16));
    $pasta = pasta_fotos_produtos();
    if (function_exists('imagewebp') && @imagewebp($foto, $pasta . '/' . $nome . '.webp', 86)) {
        $arquivo = $nome . '.webp';
    } elseif (@imagejpeg($foto, $pasta . '/' . $nome . '.jpg', 88)) {
        $arquivo = $nome . '.jpg';
    } else {
        throw new RuntimeException('Não foi possível guardar a foto.');
    }
    imagedestroy($foto);
    return $arquivo;
}

function apagar_foto_produto(string $arquivo): void
{
    if (preg_match('/^[a-f0-9]{32}\.(webp|jpg|png)$/', $arquivo) === 1) {
        @unlink(pasta_fotos_produtos() . '/' . $arquivo);
    }
}

function enviar_foto(): void
{
    conferir_post_do_site();
    $usuario = exigir_gestor();
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    $p = produto_por_id((int) ($_POST['id'] ?? 0));
    $fotos = lista_json($p['fotos']);
    if (count($fotos) >= PR_MAXIMO_FOTOS) {
        falhar(422, 'Cada produto pode ter até ' . PR_MAXIMO_FOTOS . ' fotos. Tire alguma antes de enviar outra.');
    }
    $limite = chave_limite('foto-produto', (string) $usuario['id']);
    exigir_limite($limite, 120, 3600);
    contar_tentativa($limite);

    $foto = $_FILES['foto'] ?? null;
    $erro = is_array($foto) && is_int($foto['error'] ?? null) ? $foto['error'] : UPLOAD_ERR_NO_FILE;
    if ($erro === UPLOAD_ERR_INI_SIZE || $erro === UPLOAD_ERR_FORM_SIZE || (is_array($foto) && (int) $foto['size'] > PR_MAXIMO_BYTES)) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    if ($erro !== UPLOAD_ERR_OK || !is_uploaded_file((string) $foto['tmp_name'])) {
        falhar(422, 'Escolha uma foto.');
    }
    $fotos[] = guardar_foto_produto((string) $foto['tmp_name']);
    consultar('UPDATE produtos SET fotos = ?, atualizado_em = ? WHERE id = ?', [json_encode($fotos), agora(), $p['id']]);
    $atual = produtos_com_colecao('WHERE p.id = ?', [$p['id']])[0];
    responder(201, ['produto' => produto_publico($atual, true)]);
}

// ordem: a nova lista de arquivos. Os que saírem da lista são apagados.
function mudar_fotos(): void
{
    $dados = exigir_post();
    exigir_gestor();
    $p = produto_por_id((int) ($dados['id'] ?? 0));
    $atuais = lista_json($p['fotos']);
    $nova = [];
    foreach ((is_array($dados['ordem'] ?? null) ? $dados['ordem'] : []) as $f) {
        if (is_string($f) && in_array($f, $atuais, true) && !in_array($f, $nova, true)) {
            $nova[] = $f;
        }
    }
    foreach (array_diff($atuais, $nova) as $sobra) {
        apagar_foto_produto((string) $sobra);
    }
    consultar('UPDATE produtos SET fotos = ?, atualizado_em = ? WHERE id = ?', [json_encode(array_values($nova)), agora(), $p['id']]);
    $atual = produtos_com_colecao('WHERE p.id = ?', [$p['id']])[0];
    responder(200, ['produto' => produto_publico($atual, true)]);
}

function apagar_produto(): void
{
    $dados = exigir_post();
    exigir_gestor();
    $p = produto_por_id((int) ($dados['id'] ?? 0));
    foreach (lista_json($p['fotos']) as $f) {
        apagar_foto_produto((string) $f);
    }
    consultar('DELETE FROM produtos WHERE id = ?', [$p['id']]);
    responder(200);
}

function salvar_colecao(): void
{
    $dados = exigir_post();
    exigir_gestor();
    $id = (int) ($dados['id'] ?? 0);
    $nome = str_replace("\n", ' ', texto($dados, 'nome', 80));
    $lanca = (string) ($dados['lancaEm'] ?? '');
    $erros = [];
    if (mb_strlen($nome) < 2) {
        $erros['nome'] = 'Dê um nome à coleção.';
    }
    // Data e hora no fuso do site, como 2026-12-01T19:00
    $data = DateTime::createFromFormat('Y-m-d\TH:i', $lanca);
    if (!$data || $data->format('Y-m-d\TH:i') !== $lanca) {
        $erros['lancaEm'] = 'Escolha a data e a hora do lançamento.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }
    $quando = $data->format('Y-m-d H:i:00');
    $momento = agora();
    if ($id > 0) {
        if (!consultar('SELECT id FROM colecoes WHERE id = ?', [$id])->fetch()) {
            falhar(404, 'Coleção não encontrada.');
        }
        consultar('UPDATE colecoes SET nome = ?, descricao = ?, lanca_em = ?, atualizado_em = ? WHERE id = ?',
            [$nome, texto($dados, 'descricao', 600), $quando, $momento, $id]);
    } else {
        consultar('INSERT INTO colecoes (nome, descricao, lanca_em, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)',
            [$nome, texto($dados, 'descricao', 600), $quando, $momento, $momento]);
        $id = (int) banco()->lastInsertId();
    }
    responder(200, ['id' => $id]);
}

function apagar_colecao(): void
{
    $dados = exigir_post();
    exigir_gestor();
    $id = (int) ($dados['id'] ?? 0);
    consultar('UPDATE produtos SET colecao_id = NULL WHERE colecao_id = ?', [$id]);
    consultar('DELETE FROM colecoes WHERE id = ?', [$id]);
    responder(200);
}

/* --- Pedido exclusivo --------------------------------------------------------------------------- */

function pedir_exclusivo(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];

    $erros = [];
    $peca = (string) ($dados['peca'] ?? '');
    if (!in_array($peca, EX_PECAS, true)) {
        $erros['peca'] = 'Escolha a peça.';
    }
    $tecido = (string) ($dados['tecido'] ?? '');
    if (!in_array($tecido, EX_TECIDOS, true)) {
        $erros['tecido'] = 'Escolha o tecido, ou deixe a indicação com a gente.';
    }
    $prazo = (string) ($dados['prazo'] ?? '');
    if ($prazo !== '') {
        $data = DateTime::createFromFormat('Y-m-d', $prazo);
        if (!$data || $data->format('Y-m-d') !== $prazo || $prazo < date('Y-m-d') || $prazo > date('Y-m-d', strtotime('+2 years'))) {
            $erros['prazo'] = 'Escolha uma data a partir de hoje.';
        }
    }
    $quantidade = $dados['quantidade'] ?? 1;
    if (!is_int($quantidade) || $quantidade < 1 || $quantidade > 10) {
        $erros['quantidade'] = 'De 1 a 10 peças.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }

    // Detalhes da peça: pares de códigos curtos, como gola: italiana
    $detalhes = [];
    foreach ((is_array($dados['detalhes'] ?? null) ? array_slice($dados['detalhes'], 0, 12, true) : []) as $chave => $valor) {
        if (preg_match('/^[a-z_]{1,20}$/', (string) $chave) === 1 && is_string($valor) && preg_match('/^[a-z0-9_]{1,30}$/', $valor) === 1) {
            $detalhes[(string) $chave] = $valor;
        }
    }

    $limite = chave_limite('exclusivo', (string) $id);
    exigir_limite($limite, 8, 86400);
    contar_tentativa($limite);

    $momento = agora();
    consultar(
        'INSERT INTO pedidos_exclusivos (usuario_id, peca, ocasiao, tecido, cor, caimento, detalhes, referencia, observacoes, orcamento,
         quantidade, prazo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $id, $peca,
            in_array($dados['ocasiao'] ?? '', EX_OCASIOES, true) ? $dados['ocasiao'] : '',
            $tecido,
            str_replace("\n", ' ', texto($dados, 'cor', 60)),
            in_array($dados['caimento'] ?? '', EX_CAIMENTOS, true) ? $dados['caimento'] : '',
            json_encode((object) $detalhes),
            str_replace("\n", ' ', texto($dados, 'referencia', 300)),
            texto($dados, 'observacoes', 1000),
            in_array($dados['orcamento'] ?? '', EX_ORCAMENTOS, true) ? $dados['orcamento'] : '',
            $quantidade,
            $prazo === '' ? null : $prazo,
            $momento, $momento,
        ]
    );
    $novo = (int) banco()->lastInsertId();
    registrar_evento($id, 'exclusivo_pedido', null, $peca);

    $aviso = (string) (config()['email_aviso'] ?? '');
    if ($aviso !== '') {
        enviar_email($aviso, 'Novo pedido exclusivo: ' . $peca, $usuario['nome'] . ' pediu uma peça exclusiva (' . $peca . '). Veja no painel, na aba Pedidos exclusivos.');
    }
    enviar_email(
        (string) $usuario['email'],
        'Recebemos seu pedido exclusivo | Rauber',
        "Olá!\n\nRecebemos o seu pedido de peça exclusiva. Vamos analisar o que você descreveu e responder pelo seu telefone ou por e-mail com o valor e o prazo, antes de qualquer corte.\n\nRauber"
    );
    $e = consultar('SELECT * FROM pedidos_exclusivos WHERE id = ?', [$novo])->fetch();
    responder(201, ['exclusivo' => exclusivo_publico($e)]);
}

function meus_exclusivos(): void
{
    $usuario = exigir_login();
    $lista = consultar('SELECT * FROM pedidos_exclusivos WHERE usuario_id = ? ORDER BY id DESC LIMIT 50', [(int) $usuario['id']])->fetchAll();
    responder(200, ['exclusivos' => array_map('exclusivo_publico', $lista)]);
}

function situacao_exclusivo(): void
{
    $dados = exigir_post();
    exigir_gestor();
    $situacao = (string) ($dados['situacao'] ?? '');
    if (!in_array($situacao, EX_SITUACOES, true)) {
        falhar(422, 'Situação desconhecida.');
    }
    $id = (int) ($dados['id'] ?? 0);
    $feito = consultar('UPDATE pedidos_exclusivos SET situacao = ?, atualizado_em = ? WHERE id = ?', [$situacao, agora(), $id])->rowCount();
    if ($feito === 0 && !consultar('SELECT id FROM pedidos_exclusivos WHERE id = ?', [$id])->fetch()) {
        falhar(404, 'Pedido não encontrado.');
    }
    responder(200);
}
