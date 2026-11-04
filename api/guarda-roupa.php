<?php
/**
 * Guarda-roupa: peças de cada pessoa e os looks que ela salvou ou descartou.
 *
 * GET                      lista as peças e as decisões sobre looks
 * POST ?acao=adicionar     cria a peça, com a foto (multipart)
 * POST ?acao=editar        altera a descrição
 * POST ?acao=excluir       apaga a peça e a foto
 * POST ?acao=look          salva ou descarta um look
 * POST ?acao=look-nota     guarda o nome e a observação de um look
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// As listas abaixo acompanham as de assets/js/guarda-roupa-dados.js
const GR_TIPOS = [
    'camiseta', 'regata', 'polo', 'camisa', 'malha', 'moletom',
    'blazer', 'jaqueta', 'casaco', 'colete', 'terno',
    'calca', 'jeans', 'bermuda',
    'sapato', 'mocassim', 'tenis', 'bota', 'sandalia',
    'cinto', 'gravata', 'acessorio',
];
const GR_SEM_CORTE = ['sapato', 'mocassim', 'tenis', 'bota', 'sandalia', 'cinto', 'gravata', 'acessorio'];
const GR_CORES = [
    'preto', 'branco', 'off_white', 'cinza', 'grafite', 'azul_marinho', 'azul', 'azul_claro',
    'bege', 'caqui', 'marrom', 'caramelo', 'verde_oliva', 'verde', 'bordo', 'vermelho',
    'rosa', 'amarelo', 'laranja', 'roxo', 'estampado',
];
const GR_CORTES = ['sob_medida', 'slim', 'regular', 'relaxed', 'oversized'];
const GR_TECIDOS = ['', 'algodao', 'linho', 'la', 'alfaiataria', 'jeans', 'couro', 'malha', 'sarja', 'seda', 'sintetico', 'outro'];
const GR_FORMALIDADES = ['casual', 'esporte_fino', 'social'];
const GR_CLIMAS = ['qualquer', 'calor', 'frio'];

const GR_MAXIMO_PECAS = 60;
const GR_MAXIMO_BYTES = 5242880;
const GR_MAIOR_LADO = 2400;
const GR_MENOR_LADO = 100;
const GR_MAXIMO_NOTAS = 300;

$metodo = $_SERVER['REQUEST_METHOD'] ?? '';
if ($metodo === 'GET') {
    listar();
}

switch ($_GET['acao'] ?? '') {
    case 'adicionar':
        adicionar();
        break;
    case 'editar':
        editar();
        break;
    case 'excluir':
        excluir();
        break;
    case 'look':
        decidir_look();
        break;
    case 'look-nota':
        guardar_nota_do_look();
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

/* --- Formatos ----------------------------------------------------------------- */

function peca_publica(array $p): array
{
    return [
        'id' => (int) $p['id'],
        'tipo' => $p['tipo'],
        'cor' => $p['cor'],
        'corte' => $p['corte'],
        'tecido' => $p['tecido'],
        'formalidade' => $p['formalidade'],
        'clima' => $p['clima'],
        'apelido' => $p['apelido'],
        'fundoRemovido' => (int) $p['fundo_removido'] === 1,
        // O código no endereço muda se a foto mudar, e o navegador pode guardar a imagem
        'foto' => 'api/foto-peca.php?id=' . (int) $p['id'] . '&v=' . substr((string) $p['arquivo'], 0, 8),
    ];
}

function listar(): void
{
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecas = consultar('SELECT * FROM pecas WHERE usuario_id = ? ORDER BY id DESC', [$id])->fetchAll();
    $looks = consultar('SELECT chave, situacao FROM looks WHERE usuario_id = ? ORDER BY id DESC', [$id])->fetchAll();
    $notas = consultar('SELECT chave, nome, observacao FROM looks_notas WHERE usuario_id = ?', [$id])->fetchAll();
    responder(200, [
        'pecas' => array_map('peca_publica', $pecas),
        'looks' => $looks,
        'notas' => $notas,
        'maximoPecas' => GR_MAXIMO_PECAS,
        'consentiu' => $usuario['consentiu_em'] !== null,
    ]);
}

// Confere a descrição e devolve só o que está nas listas permitidas
function validar_descricao(array $d): array
{
    $tipo = texto($d, 'tipo', 30);
    $cor = texto($d, 'cor', 30);
    $corte = texto($d, 'corte', 30);
    $tecido = texto($d, 'tecido', 30);
    $formalidade = texto($d, 'formalidade', 20);
    $clima = texto($d, 'clima', 20);

    $erros = [];
    if (!in_array($tipo, GR_TIPOS, true)) {
        $erros['tipo'] = 'Escolha o tipo da peça.';
    }
    if (!in_array($cor, GR_CORES, true)) {
        $erros['cor'] = 'Escolha a cor.';
    }
    if (in_array($tipo, GR_SEM_CORTE, true)) {
        $corte = '';
    } elseif (!in_array($corte, GR_CORTES, true)) {
        $erros['corte'] = 'Escolha o corte.';
    }
    if (!in_array($tecido, GR_TECIDOS, true)) {
        $erros['tecido'] = 'Escolha um tecido da lista.';
    }
    if (!in_array($formalidade, GR_FORMALIDADES, true)) {
        $erros['formalidade'] = 'Escolha o nível de formalidade.';
    }
    if (!in_array($clima, GR_CLIMAS, true)) {
        $erros['clima'] = 'Escolha o clima.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }

    return [
        'tipo' => $tipo,
        'cor' => $cor,
        'corte' => $corte,
        'tecido' => $tecido,
        'formalidade' => $formalidade,
        'clima' => $clima,
        'apelido' => texto($d, 'apelido', 60),
    ];
}

/* --- Foto ---------------------------------------------------------------------- */

// A imagem é regravada: isso descarta a localização que o celular guarda na foto
// e qualquer conteúdo que não seja imagem.
function guardar_foto(string $temporario): string
{
    $info = @getimagesize($temporario);
    $extensoes = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if ($info === false || !isset($extensoes[$info[2]])) {
        falhar(422, 'Envie uma foto em JPG, PNG ou WebP.', ['campos' => ['foto' => 'Este arquivo não é uma foto válida.']]);
    }
    if (max($info[0], $info[1]) > GR_MAIOR_LADO || min($info[0], $info[1]) < GR_MENOR_LADO) {
        falhar(422, 'O tamanho desta foto não é aceito.', ['campos' => ['foto' => 'O tamanho desta foto não é aceito.']]);
    }

    $nome = bin2hex(random_bytes(16));
    $pasta = pasta_fotos();

    if (function_exists('imagecreatefromstring')) {
        $imagem = @imagecreatefromstring((string) file_get_contents($temporario));
        if ($imagem !== false) {
            imagepalettetotruecolor($imagem);
            imagealphablending($imagem, false);
            imagesavealpha($imagem, true);
            $arquivo = regravar($imagem, $pasta, $nome);
            imagedestroy($imagem);
            if ($arquivo !== null) {
                return $arquivo;
            }
        }
    }

    // Hospedagem sem suporte à regravação: guarda o original já conferido
    $arquivo = $nome . '.' . $extensoes[$info[2]];
    if (!move_uploaded_file($temporario, $pasta . '/' . $arquivo)) {
        throw new RuntimeException('Não foi possível guardar a foto.');
    }
    return $arquivo;
}

function regravar($imagem, string $pasta, string $nome): ?string
{
    if (function_exists('imagewebp') && @imagewebp($imagem, $pasta . '/' . $nome . '.webp', 84)) {
        return $nome . '.webp';
    }
    if (@imagepng($imagem, $pasta . '/' . $nome . '.png', 8)) {
        return $nome . '.png';
    }
    return null;
}

/* --- Ações ---------------------------------------------------------------------- */

function adicionar(): void
{
    conferir_post_do_site();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];

    // Foto acima do limite da hospedagem: o PHP descarta o envio inteiro
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        falhar(413, 'A foto é grande demais para enviar.');
    }

    if ($usuario['consentiu_em'] === null) {
        if (($_POST['consentimento'] ?? '') !== '1') {
            falhar(403, 'Para continuar, é preciso concordar com a política de privacidade.', ['campos' => ['consentimento' => 'É preciso concordar para continuar.']]);
        }
        consultar('UPDATE usuarios SET consentiu_em = ? WHERE id = ?', [agora(), $id]);
    }

    $descricao = validar_descricao($_POST);

    $total = (int) consultar('SELECT COUNT(*) FROM pecas WHERE usuario_id = ?', [$id])->fetchColumn();
    if ($total >= GR_MAXIMO_PECAS) {
        falhar(422, 'Você chegou ao limite de ' . GR_MAXIMO_PECAS . ' peças. Exclua uma para adicionar outra.');
    }

    $limite = chave_limite('peca', (string) $id);
    exigir_limite($limite, 40, 3600);
    contar_tentativa($limite);

    $foto = $_FILES['foto'] ?? null;
    $erro = is_array($foto) && is_int($foto['error'] ?? null) ? $foto['error'] : UPLOAD_ERR_NO_FILE;
    if ($erro === UPLOAD_ERR_INI_SIZE || $erro === UPLOAD_ERR_FORM_SIZE) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    if ($erro !== UPLOAD_ERR_OK || !is_uploaded_file((string) $foto['tmp_name'])) {
        falhar(422, 'Tire ou escolha uma foto da peça.', ['campos' => ['foto' => 'Tire ou escolha uma foto da peça.']]);
    }
    if ((int) $foto['size'] > GR_MAXIMO_BYTES) {
        falhar(413, 'A foto é grande demais para enviar.');
    }

    $arquivo = guardar_foto((string) $foto['tmp_name']);
    $fundoRemovido = ($_POST['fundo_removido'] ?? '') === '1' ? 1 : 0;
    $momento = agora();

    consultar(
        'INSERT INTO pecas (usuario_id, tipo, cor, corte, tecido, formalidade, clima, apelido, arquivo, fundo_removido, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$id, $descricao['tipo'], $descricao['cor'], $descricao['corte'], $descricao['tecido'], $descricao['formalidade'],
         $descricao['clima'], $descricao['apelido'], $arquivo, $fundoRemovido, $momento, $momento]
    );
    $novoId = (int) banco()->lastInsertId();
    registrar_evento($id, 'peca_adicionada', null, $descricao['tipo']);

    $peca = consultar('SELECT * FROM pecas WHERE id = ?', [$novoId])->fetch();
    responder(201, ['peca' => peca_publica($peca)]);
}

function peca_da_pessoa(int $pecaId, int $usuarioId): array
{
    $peca = consultar('SELECT * FROM pecas WHERE id = ? AND usuario_id = ?', [$pecaId, $usuarioId])->fetch();
    if (!$peca) {
        falhar(404, 'Peça não encontrada.');
    }
    return $peca;
}

function editar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    peca_da_pessoa($pecaId, $id);

    $d = validar_descricao($dados);
    consultar(
        'UPDATE pecas SET tipo = ?, cor = ?, corte = ?, tecido = ?, formalidade = ?, clima = ?, apelido = ?, atualizado_em = ? WHERE id = ?',
        [$d['tipo'], $d['cor'], $d['corte'], $d['tecido'], $d['formalidade'], $d['clima'], $d['apelido'], agora(), $pecaId]
    );
    responder(200, ['peca' => peca_publica(peca_da_pessoa($pecaId, $id))]);
}

function excluir(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);

    // Look que usava esta peça deixa de existir, com o nome e a observação dele
    foreach (['looks', 'looks_notas'] as $tabela) {
        $linhas = consultar("SELECT id, chave FROM $tabela WHERE usuario_id = ?", [$id])->fetchAll();
        foreach ($linhas as $linha) {
            if (in_array((string) $pecaId, explode('-', (string) $linha['chave']), true)) {
                consultar("DELETE FROM $tabela WHERE id = ?", [$linha['id']]);
            }
        }
    }
    consultar('DELETE FROM pecas WHERE id = ?', [$pecaId]);
    apagar_foto((string) $peca['arquivo']);
    registrar_evento($id, 'peca_excluida', null, (string) $peca['tipo']);
    responder(200);
}

// Confere se as peças do look são da pessoa e devolve a chave, com os números em ordem
function chave_do_look(array $dados, int $id): string
{
    $pecas = is_array($dados['pecas'] ?? null) ? $dados['pecas'] : [];
    $ids = array_values(array_unique(array_map('intval', array_filter($pecas, 'is_int'))));
    sort($ids);
    if (count($ids) < 2 || count($ids) > 6 || count($ids) !== count($pecas)) {
        falhar(422, 'Look inválido.');
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $encontradas = (int) consultar(
        "SELECT COUNT(*) FROM pecas WHERE usuario_id = ? AND id IN ($marcas)",
        array_merge([$id], $ids)
    )->fetchColumn();
    if ($encontradas !== count($ids)) {
        falhar(404, 'Peça não encontrada.');
    }

    return implode('-', $ids);
}

function decidir_look(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];

    $situacao = texto($dados, 'situacao', 12);
    if (!in_array($situacao, ['salvo', 'descartado', 'nenhum'], true)) {
        falhar(422, 'Situação inválida.');
    }
    $chave = chave_do_look($dados, $id);
    consultar('DELETE FROM looks WHERE usuario_id = ? AND chave = ?', [$id, $chave]);
    if ($situacao !== 'nenhum') {
        consultar(
            'INSERT INTO looks (usuario_id, chave, situacao, criado_em) VALUES (?, ?, ?, ?)',
            [$id, $chave, $situacao, agora()]
        );
    }
    responder(200, ['chave' => $chave, 'situacao' => $situacao]);
}

function guardar_nota_do_look(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $chave = chave_do_look($dados, $id);
    $nome = str_replace("\n", ' ', texto($dados, 'nome', 60));
    $observacao = texto($dados, 'observacao', 300);

    $jaTinha = consultar('SELECT id FROM looks_notas WHERE usuario_id = ? AND chave = ?', [$id, $chave])->fetchColumn() !== false;
    if ($nome === '' && $observacao === '') {
        consultar('DELETE FROM looks_notas WHERE usuario_id = ? AND chave = ?', [$id, $chave]);
    } elseif ($jaTinha) {
        consultar(
            'UPDATE looks_notas SET nome = ?, observacao = ?, atualizado_em = ? WHERE usuario_id = ? AND chave = ?',
            [$nome, $observacao, agora(), $id, $chave]
        );
    } else {
        $total = (int) consultar('SELECT COUNT(*) FROM looks_notas WHERE usuario_id = ?', [$id])->fetchColumn();
        if ($total >= GR_MAXIMO_NOTAS) {
            falhar(422, 'Você chegou ao limite de ' . GR_MAXIMO_NOTAS . ' looks com nome ou observação. Apague algum para continuar.');
        }
        consultar(
            'INSERT INTO looks_notas (usuario_id, chave, nome, observacao, atualizado_em) VALUES (?, ?, ?, ?, ?)',
            [$id, $chave, $nome, $observacao, agora()]
        );
    }

    // Quem dá nome a uma sugestão quer guardá-la, então ela também vai para os salvos
    $situacao = consultar('SELECT situacao FROM looks WHERE usuario_id = ? AND chave = ?', [$id, $chave])->fetchColumn();
    if ($situacao === false && ($nome !== '' || $observacao !== '')) {
        consultar(
            'INSERT INTO looks (usuario_id, chave, situacao, criado_em) VALUES (?, ?, ?, ?)',
            [$id, $chave, 'salvo', agora()]
        );
        $situacao = 'salvo';
    }
    responder(200, [
        'chave' => $chave,
        'nome' => $nome,
        'observacao' => $observacao,
        'situacao' => $situacao === false ? 'nenhum' : $situacao,
    ]);
}
