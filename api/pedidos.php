<?php
/**
 * Pedidos e pagamento.
 *
 * GET                  pedidos da pessoa que está na conta
 * POST ?acao=pagar     abre a tela de pagamento do Mercado Pago
 * POST ?acao=conferir  consulta o Mercado Pago e atualiza o pedido
 * POST ?acao=criar     cria um pedido para um cliente (só administrador)
 * POST ?acao=cancelar  cancela um pedido ainda não pago (só administrador)
 * POST ?acao=encomendar cria um pedido de um produto da coleção, para a própria pessoa
 * POST ?acao=finalizar  cria um pedido só com as peças da sacola  {itens: [{slug, cor, quantidade}]}
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/mercadopago.php';

const PEDIDO_VALOR_MINIMO = 100;
const PEDIDO_VALOR_MAXIMO = 10000000;
const PEDIDOS_ABERTOS_MAXIMO = 20;
const SACOLA_MAXIMO_ITENS = 10;
const SACOLA_MAXIMO_QUANTIDADE = 5;

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $usuario = exigir_login();
    $pedidos = consultar('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC', [(int) $usuario['id']])->fetchAll();
    responder(200, ['pedidos' => array_map('pedido_publico', $pedidos), 'pagamentosAtivos' => mp_ativo()]);
}

switch ($_GET['acao'] ?? '') {
    case 'pagar':
        pagar();
        break;
    case 'conferir':
        conferir();
        break;
    case 'criar':
        criar();
        break;
    case 'cancelar':
        cancelar();
        break;
    case 'encomendar':
        encomendar();
        break;
    case 'finalizar':
        finalizar();
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

function pedido_publico(array $p): array
{
    try {
        $itens = consultar('SELECT nome, cor, quantidade, preco_centavos FROM pedidos_itens WHERE pedido_id = ? ORDER BY id', [(int) $p['id']])->fetchAll();
    } catch (PDOException $erro) {
        $itens = [];
    }
    return [
        'codigo' => $p['codigo'],
        'descricao' => $p['descricao'],
        'valorCentavos' => (int) $p['valor_centavos'],
        'freteCentavos' => (int) $p['frete_centavos'],
        'totalCentavos' => pedido_total($p),
        'situacao' => $p['situacao'],
        'metodo' => $p['metodo'],
        'parcelas' => (int) $p['parcelas'],
        'pagoEm' => $p['pago_em'],
        'criadoEm' => $p['criado_em'],
        'itens' => array_map(function (array $i): array {
            return ['nome' => $i['nome'], 'cor' => $i['cor'], 'quantidade' => (int) $i['quantidade'], 'precoCentavos' => (int) $i['preco_centavos']];
        }, $itens),
    ];
}

function pedido_por_codigo(array $dados): array
{
    $codigo = texto($dados, 'codigo', 32);
    $pedido = preg_match('/^[a-f0-9]{32}$/', $codigo) === 1
        ? consultar('SELECT * FROM pedidos WHERE codigo = ?', [$codigo])->fetch()
        : false;
    if (!$pedido) {
        falhar(404, 'Pedido não encontrado.');
    }
    return $pedido;
}

function exigir_admin(): array
{
    $usuario = exigir_login();
    if ((int) $usuario['admin'] !== 1) {
        falhar(403, 'Sem permissão.');
    }
    return $usuario;
}

// Aceita 1250, 1250,50, 1.250,50 e 1250.50. Devolve null se não for um valor.
function para_centavos(string $valor): ?int
{
    $valor = trim(str_ireplace('r$', '', $valor));
    if (preg_match('/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/', $valor) === 1) {
        $valor = str_replace('.', '', $valor);
    }
    $valor = str_replace(',', '.', $valor);
    if (preg_match('/^\d{1,9}(\.\d{1,2})?$/', $valor) !== 1) {
        return null;
    }
    $partes = explode('.', $valor);
    return (int) $partes[0] * 100 + (int) str_pad($partes[1] ?? '0', 2, '0');
}

function pagar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pedido = pedido_por_codigo($dados);
    // A outra pessoa não fica sabendo se o pedido existe
    if ((int) $pedido['usuario_id'] !== $id) {
        falhar(404, 'Pedido não encontrado.');
    }
    if (!in_array($pedido['situacao'], ['aguardando', 'processando'], true)) {
        falhar(409, 'Este pedido não está aberto para pagamento.');
    }
    if (($dados['aceite'] ?? null) !== true) {
        falhar(422, 'Para pagar, é preciso concordar com as condições de compra.', ['campos' => ['aceite' => 'É preciso concordar para continuar.']]);
    }
    if (!mp_ativo()) {
        falhar(503, 'O pagamento pelo site ainda não está disponível. Fale conosco.');
    }
    $limite = chave_limite('pagar', (string) $id);
    exigir_limite($limite, 20, 3600);
    contar_tentativa($limite);

    consultar(
        'UPDATE pedidos SET aceitou_condicoes_em = ?, atualizado_em = ? WHERE id = ?',
        [agora(), agora(), $pedido['id']]
    );
    $link = mp_criar_cobranca($pedido, $usuario);
    if ($link === null) {
        falhar(502, 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.');
    }
    registrar_evento($id, 'pagamento_aberto', null, (string) $pedido['descricao']);
    responder(200, ['link' => $link]);
}

function conferir(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $pedido = pedido_por_codigo($dados);
    if ((int) $pedido['usuario_id'] !== (int) $usuario['id'] && (int) $usuario['admin'] !== 1) {
        falhar(404, 'Pedido não encontrado.');
    }
    if (mp_ativo()) {
        $limite = chave_limite('conferir', (string) $usuario['id']);
        exigir_limite($limite, 30, 3600);
        contar_tentativa($limite);
        mp_conferir_pedido((string) $pedido['codigo']);
    }
    $atual = consultar('SELECT * FROM pedidos WHERE id = ?', [$pedido['id']])->fetch();
    responder(200, ['pedido' => pedido_publico($atual)]);
}

function criar(): void
{
    $dados = exigir_post();
    exigir_admin();

    $clienteId = (int) ($dados['usuario_id'] ?? 0);
    $cliente = consultar('SELECT id, nome, email FROM usuarios WHERE id = ?', [$clienteId])->fetch();
    if (!$cliente) {
        falhar(404, 'Pessoa não encontrada.');
    }

    $descricao = str_replace("\n", ' ', texto($dados, 'descricao', 160));
    $valor = para_centavos(texto($dados, 'valor', 20));
    $textoFrete = texto($dados, 'frete', 20);
    $frete = $textoFrete === '' ? 0 : para_centavos($textoFrete);

    $erros = [];
    if ($descricao === '') {
        $erros['descricao'] = 'Descreva o pedido.';
    }
    if ($valor === null || $valor < PEDIDO_VALOR_MINIMO || $valor > PEDIDO_VALOR_MAXIMO) {
        $erros['valor'] = 'Informe um valor entre R$ 1,00 e R$ 100.000,00.';
    }
    if ($frete === null || $frete > PEDIDO_VALOR_MAXIMO) {
        $erros['frete'] = 'Informe o frete em reais ou deixe em branco.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }

    $abertos = (int) consultar(
        "SELECT COUNT(*) FROM pedidos WHERE usuario_id = ? AND situacao IN ('aguardando', 'processando')",
        [$clienteId]
    )->fetchColumn();
    if ($abertos >= PEDIDOS_ABERTOS_MAXIMO) {
        falhar(422, 'Este cliente já tem muitos pedidos abertos. Cancele algum antes de criar outro.');
    }

    $momento = agora();
    $codigo = bin2hex(random_bytes(16));
    consultar(
        'INSERT INTO pedidos (usuario_id, codigo, descricao, valor_centavos, frete_centavos, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$clienteId, $codigo, $descricao, $valor, $frete, $momento, $momento]
    );
    registrar_evento($clienteId, 'pedido_criado', null, $descricao);
    enviar_email(
        (string) $cliente['email'],
        'Seu pedido está pronto para pagamento',
        'Seu pedido "' . $descricao . '" está pronto, no valor de ' . reais($valor + $frete) . '. Para pagar, entre em ' . mp_endereco_do_site() . '/minha-conta.html'
    );
    $pedido = consultar('SELECT * FROM pedidos WHERE codigo = ?', [$codigo])->fetch();
    responder(201, ['pedido' => pedido_publico($pedido)]);
}

function cancelar(): void
{
    $dados = exigir_post();
    exigir_admin();
    $pedido = pedido_por_codigo($dados);
    if (!in_array($pedido['situacao'], ['aguardando', 'processando'], true)) {
        falhar(409, 'Só dá para cancelar um pedido ainda não pago. Para devolver um pagamento, faça o estorno pelo Mercado Pago.');
    }
    consultar(
        "UPDATE pedidos SET situacao = 'cancelado', atualizado_em = ? WHERE id = ? AND situacao = ?",
        [agora(), $pedido['id'], $pedido['situacao']]
    );
    registrar_evento((int) $pedido['usuario_id'], 'pedido_cancelado', null, (string) $pedido['descricao']);
    $atual = consultar('SELECT * FROM pedidos WHERE id = ?', [$pedido['id']])->fetch();
    responder(200, ['pedido' => pedido_publico($atual)]);
}

// A pessoa encomenda um produto da coleção. O valor vem do banco, nunca do navegador.
function encomendar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];

    $slug = texto($dados, 'slug', 90);
    $produto = preg_match('/^[a-z0-9-]{1,90}$/', $slug) === 1
        ? consultar('SELECT p.*, c.lanca_em FROM produtos p LEFT JOIN colecoes c ON c.id = p.colecao_id WHERE p.slug = ?', [$slug])->fetch()
        : false;
    $noAr = $produto && $produto['situacao'] === 'publicado' && ($produto['lanca_em'] === null || $produto['lanca_em'] <= agora());
    if (!$noAr) {
        falhar(404, 'Este produto não está disponível agora.');
    }

    $cores = json_decode((string) $produto['cores'], true) ?: [];
    $cor = texto($dados, 'cor', 30);
    if ($cores) {
        $nomes = array_map(function ($c) { return (string) ($c['nome'] ?? ''); }, $cores);
        if (!in_array($cor, $nomes, true)) {
            falhar(422, 'Escolha a cor.', ['campos' => ['cor' => 'Escolha a cor.']]);
        }
    } else {
        $cor = '';
    }

    // A peça é feita sob medida: sem as medidas, não há como começar
    $cadastro = consultar('SELECT concluido_em FROM cadastros WHERE usuario_id = ?', [$id])->fetch();
    if (!$cadastro || $cadastro['concluido_em'] === null) {
        falhar(409, 'Preencha suas medidas antes de encomendar. Elas ficam salvas para as próximas compras.', ['precisaMedidas' => true]);
    }

    $limite = chave_limite('encomendar', (string) $id);
    exigir_limite($limite, 15, 3600);
    contar_tentativa($limite);

    $abertos = (int) consultar(
        "SELECT COUNT(*) FROM pedidos WHERE usuario_id = ? AND situacao IN ('aguardando', 'processando')",
        [$id]
    )->fetchColumn();
    if ($abertos >= PEDIDOS_ABERTOS_MAXIMO) {
        falhar(422, 'Você já tem muitos pedidos abertos. Pague ou fale conosco antes de encomendar outro.');
    }

    $descricao = mb_substr($produto['nome'] . ' sob medida' . ($cor !== '' ? ', ' . $cor : ''), 0, 160);
    $momento = agora();
    $codigo = bin2hex(random_bytes(16));
    consultar(
        'INSERT INTO pedidos (usuario_id, codigo, descricao, valor_centavos, frete_centavos, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$id, $codigo, $descricao, (int) $produto['preco_centavos'], (int) $produto['frete_centavos'], $momento, $momento]
    );
    registrar_evento($id, 'pedido_criado', null, $descricao);
    $pedido = consultar('SELECT * FROM pedidos WHERE codigo = ?', [$codigo])->fetch();
    responder(201, ['pedido' => pedido_publico($pedido)]);
}

// Produto à venda agora e a cor escolhida. Sem cor válida, recusa.
function produto_a_venda(string $slug, string $cor): array
{
    $produto = preg_match('/^[a-z0-9-]{1,90}$/', $slug) === 1
        ? consultar('SELECT p.*, c.lanca_em FROM produtos p LEFT JOIN colecoes c ON c.id = p.colecao_id WHERE p.slug = ?', [$slug])->fetch()
        : false;
    $noAr = $produto && $produto['situacao'] === 'publicado' && ($produto['lanca_em'] === null || $produto['lanca_em'] <= agora());
    if (!$noAr) {
        falhar(404, 'Uma das peças da sacola não está mais disponível. Tire ela para continuar.', ['indisponivel' => $slug]);
    }
    $cores = json_decode((string) $produto['cores'], true) ?: [];
    if ($cores) {
        $nomes = array_map(function ($c) { return (string) ($c['nome'] ?? ''); }, $cores);
        if (!in_array($cor, $nomes, true)) {
            falhar(422, 'Escolha a cor de ' . $produto['nome'] . '.', ['indisponivel' => $slug]);
        }
    } else {
        $cor = '';
    }
    $produto['cor_escolhida'] = $cor;
    return $produto;
}

/** A sacola vira um pedido só: as peças somadas e o maior frete, porque vão juntas. */
function finalizar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $lista = is_array($dados['itens'] ?? null) ? array_values($dados['itens']) : [];
    if (!$lista) {
        falhar(422, 'A sacola está vazia.');
    }
    if (count($lista) > SACOLA_MAXIMO_ITENS) {
        falhar(422, 'São no máximo ' . SACOLA_MAXIMO_ITENS . ' peças diferentes por pedido.');
    }
    $cadastro = consultar('SELECT concluido_em FROM cadastros WHERE usuario_id = ?', [$id])->fetch();
    if (!$cadastro || $cadastro['concluido_em'] === null) {
        falhar(409, 'Preencha suas medidas antes de finalizar. As peças são feitas a partir delas, e ficam salvas para as próximas compras.', ['precisaMedidas' => true]);
    }
    $limite = chave_limite('encomendar', (string) $id);
    exigir_limite($limite, 15, 3600);
    contar_tentativa($limite);
    $abertos = (int) consultar("SELECT COUNT(*) FROM pedidos WHERE usuario_id = ? AND situacao IN ('aguardando', 'processando')", [$id])->fetchColumn();
    if ($abertos >= PEDIDOS_ABERTOS_MAXIMO) {
        falhar(422, 'Você já tem muitos pedidos abertos. Pague ou fale conosco antes de fazer outro.');
    }

    $itens = [];
    foreach ($lista as $item) {
        if (!is_array($item)) {
            falhar(422, 'Sacola inválida.');
        }
        $quantidade = $item['quantidade'] ?? 1;
        if (!is_int($quantidade) || $quantidade < 1 || $quantidade > SACOLA_MAXIMO_QUANTIDADE) {
            falhar(422, 'Escolha de 1 a ' . SACOLA_MAXIMO_QUANTIDADE . ' unidades de cada peça.');
        }
        $produto = produto_a_venda(texto($item, 'slug', 90), texto($item, 'cor', 30));
        $chave = $produto['id'] . '|' . $produto['cor_escolhida'];
        if (isset($itens[$chave])) {
            $itens[$chave]['quantidade'] = min(SACOLA_MAXIMO_QUANTIDADE, $itens[$chave]['quantidade'] + $quantidade);
        } else {
            $itens[$chave] = ['produto' => $produto, 'quantidade' => $quantidade];
        }
    }
    $itens = array_values($itens);
    $valor = 0;
    $frete = 0;
    $pecas = 0;
    foreach ($itens as $i) {
        $valor += (int) $i['produto']['preco_centavos'] * $i['quantidade'];
        $frete = max($frete, (int) $i['produto']['frete_centavos']);
        $pecas += $i['quantidade'];
    }
    if ($valor < PEDIDO_VALOR_MINIMO || $valor > PEDIDO_VALOR_MAXIMO) {
        falhar(422, 'O valor deste pedido não é aceito. Fale conosco.');
    }
    $nome = function (array $i): string {
        return $i['produto']['nome'] . ($i['produto']['cor_escolhida'] !== '' ? ' (' . $i['produto']['cor_escolhida'] . ')' : '');
    };
    if ($pecas === 1) {
        $descricao = $itens[0]['produto']['nome'] . ' sob medida' . ($itens[0]['produto']['cor_escolhida'] !== '' ? ', ' . $itens[0]['produto']['cor_escolhida'] : '');
    } else {
        $descricao = $pecas . ' peças sob medida: ' . implode(', ', array_map(function ($i) use ($nome) {
            return ($i['quantidade'] > 1 ? $i['quantidade'] . '× ' : '') . $nome($i);
        }, $itens));
    }
    if (mb_strlen($descricao) > 160) {
        $descricao = mb_substr($descricao, 0, 157) . '...';
    }

    $momento = agora();
    $codigo = bin2hex(random_bytes(16));
    banco()->beginTransaction();
    try {
        consultar(
            'INSERT INTO pedidos (usuario_id, codigo, descricao, valor_centavos, frete_centavos, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$id, $codigo, $descricao, $valor, $frete, $momento, $momento]
        );
        $pedidoId = (int) banco()->lastInsertId();
        foreach ($itens as $i) {
            consultar(
                'INSERT INTO pedidos_itens (pedido_id, produto_id, nome, cor, quantidade, preco_centavos) VALUES (?, ?, ?, ?, ?, ?)',
                [$pedidoId, (int) $i['produto']['id'], mb_substr((string) $i['produto']['nome'], 0, 90), mb_substr($i['produto']['cor_escolhida'], 0, 30), $i['quantidade'], (int) $i['produto']['preco_centavos']]
            );
        }
        banco()->commit();
    } catch (Throwable $erro) {
        banco()->rollBack();
        throw $erro;
    }
    registrar_evento($id, 'pedido_criado', null, mb_substr($descricao, 0, 120));
    $pedido = consultar('SELECT * FROM pedidos WHERE codigo = ?', [$codigo])->fetch();
    responder(201, ['pedido' => pedido_publico($pedido), 'pagamentosAtivos' => mp_ativo()]);
}
