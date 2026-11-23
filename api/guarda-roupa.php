<?php
/**
 * Guarda-roupa: peças de cada pessoa e os looks que ela salvou ou descartou.
 *
 * GET                      lista as peças e as decisões sobre looks
 * POST ?acao=adicionar     cria a peça, com a foto (multipart)
 * POST ?acao=editar        altera a descrição
 * POST ?acao=excluir       tira a peça do guarda-roupa, e ela fica em Excluídas
 * POST ?acao=excluir-sugeridas  tira todas as peças sugeridas de uma vez
 * POST ?acao=restaurar     adiciona de novo uma peça excluída
 * POST ?acao=apagar        apaga de vez uma peça excluída e a foto dela
 * POST ?acao=look          salva ou descarta um look
 * POST ?acao=look-nota     guarda o nome e a observação de um look
 * POST ?acao=trocar-foto   troca a foto de uma peça (multipart)
 * POST ?acao=preco         guarda quanto a pessoa pagou na peça
 * POST ?acao=uso           anota no diário o que a pessoa usou
 * POST ?acao=apagar-uso    tira uma anotação do diário
 *
 * Catálogo de peças (as da marca, em várias cores, e as que o gestor cadastra no painel):
 * GET  ?acao=catalogo           o catálogo, com o que a pessoa já tem
 * GET  ?acao=foto-catalogo&id=  a foto de uma peça cadastrada pelo gestor
 * POST ?acao=do-catalogo        coloca uma peça do catálogo no guarda-roupa  {codigo}
 * GET  ?acao=catalogo-gestor    (gestor) as peças cadastradas no painel
 * POST ?acao=catalogo-salvar    (gestor) cadastra ou altera uma peça, com a foto (multipart)
 * POST ?acao=catalogo-ativar    (gestor) mostra ou esconde uma peça do catálogo  {id, ativa}
 *
 * Foto da peça achada na internet (SerpApi ou Brave; a chave fica no config.php, em serpapi_chave ou brave_busca):
 * GET  ?acao=buscar-foto&q=     imagens para a descrição da pessoa, com fundo branco
 * GET  ?acao=foto-web&u=&a=     a imagem escolhida, trazida pelo site para passar pelo "tirar o fundo"
 *
 * O guarda-roupa de cada pessoa começa vazio: ela adiciona as peças pelo catálogo, pela foto ou pela busca.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// Com a cobrança ligada no painel, só quem assina usa os apps
exigir_acesso_apps(['foto-catalogo', 'catalogo-gestor', 'catalogo-salvar', 'catalogo-ativar']);

// As listas abaixo acompanham as de assets/js/guarda-roupa-dados.js
const GR_TIPOS = [
    'camiseta', 'regata', 'polo', 'camisa', 'camisa_curta', 'malha', 'moletom', 'blusa',
    'blazer', 'jaqueta', 'casaco', 'sobretudo', 'cardigan', 'colete', 'terno', 'vestido',
    'calca', 'calca_sarja', 'jeans', 'calca_moletom', 'saia', 'bermuda', 'short_esportivo',
    'sapato', 'mocassim', 'tenis', 'bota', 'sandalia', 'chinelo',
    'cinto', 'gravata', 'bone', 'oculos', 'relogio', 'acessorio',
];
const GR_SEM_CORTE = ['sapato', 'mocassim', 'tenis', 'bota', 'sandalia', 'chinelo', 'cinto', 'gravata', 'bone', 'oculos', 'relogio', 'acessorio'];
const GR_CORES = [
    'preto', 'branco', 'off_white', 'cinza', 'grafite', 'azul_marinho', 'azul', 'azul_claro',
    'bege', 'caqui', 'marrom', 'caramelo', 'verde_oliva', 'verde', 'bordo', 'vermelho',
    'rosa', 'amarelo', 'laranja', 'roxo', 'estampado',
];
const GR_CORTES = ['sob_medida', 'slim', 'regular', 'reto', 'relaxed', 'skinny', 'wide_leg', 'flare', 'oversized'];
const GR_TECIDOS = ['', 'algodao', 'linho', 'la', 'tricot', 'moletom', 'alfaiataria', 'jeans', 'couro', 'camurca', 'malha', 'sarja', 'veludo', 'seda', 'sintetico', 'outro'];
const GR_FORMALIDADES = ['esportivo', 'casual', 'misto', 'trabalho', 'festa', 'social'];
const GR_CLIMAS = ['qualquer', 'calor', 'meia_estacao', 'frio'];

// Peças sugeridas pela marca. A foto de cada uma fica em assets/img/sugeridas.
const GR_SUGERIDAS = [
    'camiseta-branca' => ['camiseta', 'branco', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta branca'],
    'camiseta-preta' => ['camiseta', 'preto', 'regular', 'algodao', 'casual', 'qualquer', 'Camiseta preta'],
    'camisa-branca' => ['camisa', 'branco', 'regular', 'algodao', 'misto', 'qualquer', 'Camisa branca'],
    'sueter-preto' => ['malha', 'preto', 'relaxed', 'tricot', 'misto', 'frio', 'Suéter preto'],
    'moletom-cinza' => ['moletom', 'cinza', 'oversized', 'moletom', 'casual', 'frio', 'Moletom cinza'],
    'moletom-preto' => ['moletom', 'preto', 'oversized', 'moletom', 'casual', 'frio', 'Moletom preto'],
    'blazer-transpassado-preto' => ['blazer', 'preto', 'regular', 'alfaiataria', 'social', 'qualquer', 'Blazer transpassado'],
    'calca-alfaiataria-preta' => ['calca', 'preto', 'relaxed', 'alfaiataria', 'misto', 'qualquer', 'Calça de alfaiataria'],
    'calca-jeans-lavagem-azul' => ['jeans', 'azul', 'relaxed', 'jeans', 'casual', 'qualquer', 'Jeans lavagem média'],
    'calca-jeans-lavagem-clara' => ['jeans', 'azul_claro', 'relaxed', 'jeans', 'casual', 'qualquer', 'Jeans lavagem clara'],
    'calca-jeans-lavagem-escura' => ['jeans', 'azul_marinho', 'reto', 'jeans', 'casual', 'qualquer', 'Jeans lavagem escura'],
    'calca-moletom-cinza' => ['calca_moletom', 'cinza', 'relaxed', 'moletom', 'casual', 'frio', 'Calça de moletom cinza'],
    'calca-moletom-preto' => ['calca_moletom', 'preto', 'relaxed', 'moletom', 'casual', 'frio', 'Calça de moletom preta'],
    'sapato-social' => ['sapato', 'preto', '', 'couro', 'social', 'qualquer', 'Sapato social preto'],
    'tenis-new-balance' => ['tenis', 'branco', '', 'sintetico', 'casual', 'qualquer', 'Tênis New Balance'],
    'tenis-nike' => ['tenis', 'branco', '', 'couro', 'casual', 'qualquer', 'Tênis Nike branco'],
    'gravata' => ['gravata', 'preto', '', 'seda', 'social', 'qualquer', 'Gravata listrada'],
    'bone-preto' => ['bone', 'preto', '', 'algodao', 'casual', 'qualquer', 'Boné preto'],
];
const GR_PREFIXO_SUGERIDA = 'catalogo:';

// Peças do catálogo da marca em outras cores. Não entram sozinhas: a pessoa escolhe as que tem.
// A foto de cada uma fica em assets/img/sugeridas, como as sugeridas.
const GR_CATALOGO = [
    'camiseta-off-white' => ['camiseta', 'off_white', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta off-white'],
    'camiseta-cinza' => ['camiseta', 'cinza', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta cinza'],
    'camiseta-azul-marinho' => ['camiseta', 'azul_marinho', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta azul-marinho'],
    'camiseta-azul-claro' => ['camiseta', 'azul_claro', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta azul-clara'],
    'camiseta-verde-oliva' => ['camiseta', 'verde_oliva', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta verde-oliva'],
    'camiseta-bege' => ['camiseta', 'bege', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta bege'],
    'camiseta-marrom' => ['camiseta', 'marrom', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta marrom'],
    'camiseta-bordo' => ['camiseta', 'bordo', 'relaxed', 'algodao', 'casual', 'qualquer', 'Camiseta bordô'],
    'camisa-azul-clara' => ['camisa', 'azul_claro', 'regular', 'algodao', 'misto', 'qualquer', 'Camisa azul-clara'],
    'camisa-azul-marinho' => ['camisa', 'azul_marinho', 'regular', 'algodao', 'misto', 'qualquer', 'Camisa azul-marinho'],
    'camisa-rosa' => ['camisa', 'rosa', 'regular', 'algodao', 'misto', 'qualquer', 'Camisa rosa'],
    'camisa-bege' => ['camisa', 'bege', 'regular', 'linho', 'misto', 'calor', 'Camisa bege'],
    'camisa-verde-oliva' => ['camisa', 'verde_oliva', 'regular', 'algodao', 'misto', 'qualquer', 'Camisa verde-oliva'],
    'moletom-off-white' => ['moletom', 'off_white', 'oversized', 'moletom', 'casual', 'frio', 'Moletom off-white'],
    'moletom-azul-marinho' => ['moletom', 'azul_marinho', 'oversized', 'moletom', 'casual', 'frio', 'Moletom azul-marinho'],
    'moletom-verde-oliva' => ['moletom', 'verde_oliva', 'oversized', 'moletom', 'casual', 'frio', 'Moletom verde-oliva'],
    'moletom-bege' => ['moletom', 'bege', 'oversized', 'moletom', 'casual', 'frio', 'Moletom bege'],
    'moletom-marrom' => ['moletom', 'marrom', 'oversized', 'moletom', 'casual', 'frio', 'Moletom marrom'],
    'moletom-bordo' => ['moletom', 'bordo', 'oversized', 'moletom', 'casual', 'frio', 'Moletom bordô'],
    'calca-moletom-azul-marinho' => ['calca_moletom', 'azul_marinho', 'relaxed', 'moletom', 'casual', 'frio', 'Calça de moletom azul-marinho'],
    'calca-moletom-bege' => ['calca_moletom', 'bege', 'relaxed', 'moletom', 'casual', 'frio', 'Calça de moletom bege'],
    'calca-moletom-verde-oliva' => ['calca_moletom', 'verde_oliva', 'relaxed', 'moletom', 'casual', 'frio', 'Calça de moletom verde-oliva'],
    // Femininas
    'camiseta-feminina-branca' => ['camiseta', 'branco', 'slim', 'algodao', 'casual', 'qualquer', 'Camiseta feminina branca'],
    'camiseta-feminina-preta' => ['camiseta', 'preto', 'slim', 'algodao', 'casual', 'qualquer', 'Camiseta feminina preta'],
    'camiseta-feminina-rosa' => ['camiseta', 'rosa', 'slim', 'algodao', 'casual', 'qualquer', 'Camiseta feminina rosa'],
    'jeans-skinny-escuro' => ['jeans', 'azul_marinho', 'skinny', 'jeans', 'casual', 'qualquer', 'Jeans skinny escuro'],
    'jeans-flare-azul' => ['jeans', 'azul', 'flare', 'jeans', 'casual', 'qualquer', 'Jeans flare'],
    'jeans-wide-leg-claro' => ['jeans', 'azul_claro', 'wide_leg', 'jeans', 'casual', 'qualquer', 'Jeans wide leg claro'],
    'sueter-gola-v-preto' => ['malha', 'preto', 'relaxed', 'tricot', 'misto', 'frio', 'Suéter gola V preto'],
    'sueter-gola-v-bege' => ['malha', 'bege', 'relaxed', 'tricot', 'misto', 'frio', 'Suéter gola V bege'],
    'sueter-gola-v-cinza' => ['malha', 'cinza', 'relaxed', 'tricot', 'misto', 'frio', 'Suéter gola V cinza'],
    'sueter-gola-v-bordo' => ['malha', 'bordo', 'relaxed', 'tricot', 'misto', 'frio', 'Suéter gola V bordô'],
    'blazer-feminino-preto' => ['blazer', 'preto', 'slim', 'alfaiataria', 'social', 'qualquer', 'Blazer feminino preto'],
    'vestido-camiseta-preto' => ['vestido', 'preto', 'regular', 'malha', 'casual', 'qualquer', 'Vestido midi preto'],
    'vestido-camiseta-off-white' => ['vestido', 'off_white', 'regular', 'malha', 'casual', 'calor', 'Vestido midi off-white'],
    'vestido-camiseta-cinza' => ['vestido', 'cinza', 'regular', 'malha', 'casual', 'qualquer', 'Vestido midi cinza'],
    'vestido-camiseta-verde-oliva' => ['vestido', 'verde_oliva', 'regular', 'malha', 'casual', 'qualquer', 'Vestido midi verde-oliva'],
    'vestido-camiseta-bordo' => ['vestido', 'bordo', 'regular', 'malha', 'misto', 'qualquer', 'Vestido midi bordô'],
    'vestido-chemise-branco' => ['vestido', 'branco', 'regular', 'algodao', 'misto', 'qualquer', 'Vestido chemise branco'],
    'vestido-chemise-azul-claro' => ['vestido', 'azul_claro', 'regular', 'algodao', 'misto', 'qualquer', 'Vestido chemise azul-claro'],
    'vestido-chemise-bege' => ['vestido', 'bege', 'regular', 'linho', 'misto', 'calor', 'Vestido chemise bege'],
];
// Para quem é cada peça da marca no catálogo: masculino, feminino ou para todos
const GR_PUBLICOS = ['masculino', 'feminino', 'unissex'];
const GR_PREFIXOS_FEMININOS = ['camiseta-feminina', 'jeans-skinny', 'jeans-flare', 'jeans-wide-leg', 'sueter-gola-v', 'blazer-feminino', 'vestido-'];
const GR_TIPOS_FEMININOS = ['vestido', 'saia', 'blusa'];
const GR_TIPOS_UNISSEX = ['moletom', 'calca_moletom', 'bone', 'tenis', 'oculos', 'relogio'];
// Peças cadastradas pelo gestor: o código é loja-ID e a foto fica em api/fotos-catalogo
const GR_PREFIXO_LOJA = 'loja-';
// Peças da coleção Rauber à venda: entram sozinhas no catálogo, uma por cor. O código é rauber-ID-cor.
const GR_PREFIXO_COLECAO = 'rauber-';
// Categoria da coleção -> tipo, formalidade e clima no guarda-roupa
const GR_DA_CATEGORIA = [
    'camiseta' => ['camiseta', 'casual', 'qualquer'], 'polo' => ['polo', 'casual', 'qualquer'], 'camisa' => ['camisa', 'misto', 'qualquer'],
    'calca' => ['calca', 'misto', 'qualquer'], 'bermuda' => ['bermuda', 'casual', 'calor'], 'blazer' => ['blazer', 'misto', 'qualquer'],
    'terno' => ['terno', 'social', 'qualquer'], 'colete' => ['colete', 'misto', 'qualquer'], 'jaqueta' => ['jaqueta', 'casual', 'frio'],
];
const GR_CORTE_DA_MODELAGEM = ['ajustada' => 'slim', 'regular' => 'regular', 'solta' => 'relaxed'];
// Acompanha as cores de assets/js/guarda-roupa-dados.js
const GR_HEX_DAS_CORES = [
    'preto' => '141414', 'branco' => 'f5f5f3', 'off_white' => 'e8e2d2', 'cinza' => '9a9a98', 'grafite' => '44464a',
    'azul_marinho' => '1b2a4a', 'azul' => '2f62b0', 'azul_claro' => 'a3c3e0', 'bege' => 'cdbb9b', 'caqui' => 'a39566',
    'marrom' => '54392a', 'caramelo' => 'a2672f', 'verde_oliva' => '555b38', 'verde' => '2d7a4b', 'bordo' => '5c1322',
    'vermelho' => 'b5261e', 'rosa' => 'e0a3b2', 'amarelo' => 'e2bd36', 'laranja' => 'd9702a', 'roxo' => '5e3a87',
];
const GR_MAXIMO_CATALOGO = 300;

const GR_MAXIMO_PECAS = 60;
// Comprimento das peças de cima, para as dicas de proporção
const GR_COMPRIMENTOS = ['', 'curta', 'certa', 'longa'];
// Busca da foto da peça na internet
const GR_BUSCA_RESULTADOS = 24;
const GR_FOTO_WEB_BYTES = 6000000;
// Peças próprias somando as excluídas, cujas fotos continuam guardadas
const GR_MAXIMO_COM_EXCLUIDAS = 120;
const GR_MAXIMO_BYTES = 5242880;
const GR_MAIOR_LADO = 2400;
const GR_MENOR_LADO = 100;
const GR_MAXIMO_NOTAS = 300;
const GR_MAXIMO_USOS = 3000;
// Até R$ 50.000,00, em centavos
const GR_MAIOR_PRECO = 5000000;

$metodo = $_SERVER['REQUEST_METHOD'] ?? '';
if ($metodo === 'GET') {
    switch ($_GET['acao'] ?? '') {
        case 'catalogo':
            catalogo();
            break;
        case 'foto-catalogo':
            foto_catalogo();
            break;
        case 'catalogo-gestor':
            catalogo_gestor();
            break;
        case 'buscar-foto':
            buscar_foto();
            break;
        case 'foto-web':
            foto_web();
            break;
    }
    listar();
}

switch ($_GET['acao'] ?? '') {
    case 'do-catalogo':
        do_catalogo();
        break;
    case 'catalogo-salvar':
        catalogo_salvar();
        break;
    case 'catalogo-ativar':
        catalogo_ativar();
        break;
    case 'adicionar':
        adicionar();
        break;
    case 'editar':
        editar();
        break;
    case 'excluir':
        excluir();
        break;
    case 'excluir-sugeridas':
        excluir_sugeridas();
        break;
    case 'restaurar':
        restaurar();
        break;
    case 'apagar':
        apagar();
        break;
    case 'look':
        decidir_look();
        break;
    case 'look-nota':
        guardar_nota_do_look();
        break;
    case 'trocar-foto':
        trocar_foto();
        break;
    case 'preco':
        guardar_preco();
        break;
    case 'uso':
        anotar_uso();
        break;
    case 'apagar-uso':
        apagar_uso();
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

/* --- Formatos ----------------------------------------------------------------- */

function eh_sugerida(array $p): bool
{
    return strpos((string) $p['arquivo'], GR_PREFIXO_SUGERIDA) === 0;
}

function foto_da_peca(array $p): string
{
    if (eh_sugerida($p)) {
        $codigo = substr((string) $p['arquivo'], strlen(GR_PREFIXO_SUGERIDA));
        if (strpos($codigo, GR_PREFIXO_COLECAO) === 0) {
            return foto_do_produto((int) explode('-', $codigo)[1]);
        }
        if (strpos($codigo, GR_PREFIXO_LOJA) === 0) {
            return 'api/guarda-roupa.php?acao=foto-catalogo&id=' . (int) substr($codigo, strlen(GR_PREFIXO_LOJA));
        }
        return 'assets/img/sugeridas/' . $codigo . '.webp';
    }
    // O código no endereço muda se a foto mudar, e o navegador pode guardar a imagem
    return 'api/foto-peca.php?id=' . (int) $p['id'] . '&v=' . substr((string) $p['arquivo'], 0, 8);
}

// Cada pessoa recebe cada peça sugerida uma vez. Depois disso, é ela quem decide:
// o que excluiu não volta sozinho. O registro à parte também impede duplicar a peça
// se duas abas abrirem o guarda-roupa ao mesmo tempo.
function entregar_sugeridas(int $id): void
{
    $recebidas = consultar('SELECT codigo FROM pecas_sugeridas_recebidas WHERE usuario_id = ?', [$id])->fetchAll(PDO::FETCH_COLUMN);
    $entregar = GR_SUGERIDAS;
    // As peças que o gestor cadastrou para entrar no guarda-roupa de todo mundo
    foreach (pecas_do_gestor(true) as $c) {
        $entregar[GR_PREFIXO_LOJA . $c['id']] = linha_do_catalogo($c);
    }
    foreach ($entregar as $codigo => $p) {
        if (!in_array($codigo, $recebidas, true)) {
            entregar_peca($id, (string) $codigo, $p);
        }
    }
}

// Coloca uma peça do catálogo no guarda-roupa. O registro à parte impede duplicar.
function entregar_peca(int $id, string $codigo, array $p): ?int
{
    try {
        consultar('INSERT INTO pecas_sugeridas_recebidas (usuario_id, codigo) VALUES (?, ?)', [$id, $codigo]);
    } catch (PDOException $erro) {
        if ((string) $erro->getCode() === '23000') {
            return null;
        }
        throw $erro;
    }
    $momento = agora();
    consultar(
        'INSERT INTO pecas (usuario_id, tipo, cor, corte, tecido, formalidade, clima, apelido, arquivo, fundo_removido, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [$id, $p[0], $p[1], $p[2], $p[3], $p[4], $p[5], $p[6], GR_PREFIXO_SUGERIDA . $codigo, $momento, $momento]
    );
    return (int) banco()->lastInsertId();
}

// Peças ativas cadastradas pelo gestor. Antes de importar o banco.sql novo, nenhuma.
function pecas_do_gestor(bool $soAutomaticas = false): array
{
    try {
        return consultar('SELECT * FROM catalogo_pecas WHERE ativa = 1' . ($soAutomaticas ? ' AND automatica = 1' : '') . ' ORDER BY id DESC')->fetchAll();
    } catch (PDOException $erro) {
        return [];
    }
}

function publico_da_marca(string $codigo, string $tipo): string
{
    foreach (GR_PREFIXOS_FEMININOS as $prefixo) {
        if (strpos($codigo, $prefixo) === 0) {
            return 'feminino';
        }
    }
    if (in_array($tipo, GR_TIPOS_FEMININOS, true)) {
        return 'feminino';
    }
    return in_array($tipo, GR_TIPOS_UNISSEX, true) ? 'unissex' : 'masculino';
}

// Para quem é cada peça cadastrada pelo gestor (tabela à parte; sem ela, vale o tipo da peça)
function publicos_do_gestor(): array
{
    try {
        $mapa = [];
        foreach (consultar('SELECT catalogo_id, publico FROM catalogo_publico')->fetchAll() as $l) {
            $mapa[(int) $l['catalogo_id']] = (string) $l['publico'];
        }
        return $mapa;
    } catch (PDOException $erro) {
        return [];
    }
}

/* --- Peças da coleção no catálogo ----------------------------------------------------------- */

function sem_acento(string $t): string
{
    $t = mb_strtolower(trim($t));
    $t = strtr($t, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c']);
    return (string) preg_replace('/[\s-]+/', '_', $t);
}

/** A cor da coleção na lista do guarda-roupa: pelo nome (preto, preta, azul-marinho) ou pela cor mais próxima. */
function cor_do_guarda_roupa(array $cor): string
{
    $nome = sem_acento((string) ($cor['nome'] ?? ''));
    $femininos = ['preta' => 'preto', 'branca' => 'branco', 'vermelha' => 'vermelho', 'amarela' => 'amarelo', 'roxa' => 'roxo', 'marinho' => 'azul_marinho', 'off' => 'off_white', 'offwhite' => 'off_white', 'oliva' => 'verde_oliva', 'vinho' => 'bordo', 'chumbo' => 'grafite', 'areia' => 'bege', 'creme' => 'off_white'];
    if (isset(GR_HEX_DAS_CORES[$nome])) {
        return $nome;
    }
    if (isset($femininos[$nome])) {
        return $femininos[$nome];
    }
    $hex = strtolower(ltrim((string) ($cor['hex'] ?? ''), '#'));
    if (preg_match('/^[0-9a-f]{6}$/', $hex) !== 1) {
        return 'preto';
    }
    $alvo = [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    $melhor = 'preto';
    $distancia = PHP_INT_MAX;
    foreach (GR_HEX_DAS_CORES as $id => $h) {
        $d = ($alvo[0] - hexdec(substr($h, 0, 2))) ** 2 + ($alvo[1] - hexdec(substr($h, 2, 2))) ** 2 + ($alvo[2] - hexdec(substr($h, 4, 2))) ** 2;
        if ($d < $distancia) {
            $distancia = $d;
            $melhor = $id;
        }
    }
    return $melhor;
}

function tecido_do_produto(string $texto): string
{
    $t = sem_acento($texto);
    foreach (['linho' => 'linho', 'jeans' => 'jeans', 'sarja' => 'sarja', 'moletom' => 'moletom', 'alfaiataria' => 'alfaiataria', 'la_fria' => 'alfaiataria', 'malha' => 'malha', 'algodao' => 'algodao', 'tricot' => 'tricot', 'veludo' => 'veludo', 'seda' => 'seda'] as $chave => $tecido) {
        if (strpos($t, $chave) !== false) {
            return $tecido;
        }
    }
    return '';
}

/** A primeira foto de uma peça da coleção (também para quem já tem a peça e ela saiu da vitrine). */
function foto_do_produto(int $id): string
{
    static $fotos = [];
    if (!array_key_exists($id, $fotos)) {
        $linha = consultar('SELECT fotos FROM produtos WHERE id = ?', [$id])->fetchColumn();
        $lista = json_decode((string) $linha, true);
        $fotos[$id] = is_array($lista) && isset($lista[0]) && is_string($lista[0]) ? 'api/produtos.php?acao=foto&f=' . $lista[0] : 'assets/img/sugeridas/camiseta-bege.webp';
    }
    return $fotos[$id];
}

/** Peças da coleção à venda (publicadas ou esgotadas, com a coleção já lançada), uma por cor. */
function pecas_da_colecao(): array
{
    try {
        $produtos = consultar(
            "SELECT p.id, p.slug, p.nome, p.categoria, p.modelagem, p.tecido, p.cores, p.fotos, p.criado_em
             FROM produtos p LEFT JOIN colecoes c ON c.id = p.colecao_id
             WHERE p.situacao IN ('publicado', 'esgotado') AND (p.colecao_id IS NULL OR c.lanca_em IS NULL OR c.lanca_em <= ?)
             ORDER BY p.ordem, p.id DESC",
            [agora()]
        )->fetchAll();
    } catch (PDOException $erro) {
        return [];
    }
    $recente = date('Y-m-d H:i:s', time() - 30 * 86400);
    $lista = [];
    foreach ($produtos as $p) {
        $base = GR_DA_CATEGORIA[$p['categoria']] ?? null;
        $fotos = json_decode((string) $p['fotos'], true);
        if ($base === null || !is_array($fotos) || !isset($fotos[0])) {
            continue;
        }
        $cores = json_decode((string) $p['cores'], true);
        $cores = is_array($cores) && $cores ? array_slice($cores, 0, 8) : [['nome' => '', 'hex' => '']];
        $vistas = [];
        foreach ($cores as $c) {
            $cor = cor_do_guarda_roupa(is_array($c) ? $c : []);
            if (isset($vistas[$cor])) {
                continue;
            }
            $vistas[$cor] = true;
            $nomeCor = is_array($c) ? trim((string) ($c['nome'] ?? '')) : '';
            $lista[GR_PREFIXO_COLECAO . $p['id'] . '-' . $cor] = [
                'linha' => [$base[0], $cor, GR_CORTE_DA_MODELAGEM[$p['modelagem']] ?? 'regular', tecido_do_produto((string) $p['tecido']), $base[1], $base[2],
                    mb_substr($p['nome'] . ($nomeCor !== '' ? ' ' . mb_strtolower($nomeCor) : ''), 0, 60)],
                'foto' => 'api/produtos.php?acao=foto&f=' . $fotos[0],
                'novo' => (string) $p['criado_em'] >= $recente,
                'publico' => 'masculino',
                'colecao' => (string) $p['slug'],
            ];
        }
    }
    return $lista;
}

function linha_do_catalogo(array $c): array
{
    return [$c['tipo'], $c['cor'], $c['corte'], $c['tecido'], $c['formalidade'], $c['clima'], $c['nome']];
}

/* --- Catálogo ----------------------------------------------------------------------- */

// Todas as peças que a pessoa pode escolher: as sugeridas, as cores novas e as do gestor
function pecas_do_catalogo(): array
{
    $lista = [];
    foreach ([GR_SUGERIDAS, GR_CATALOGO] as $grupo) {
        foreach ($grupo as $codigo => $p) {
            $lista[$codigo] = ['linha' => $p, 'foto' => 'assets/img/sugeridas/' . $codigo . '.webp', 'novo' => false, 'publico' => publico_da_marca((string) $codigo, $p[0])];
        }
    }
    $recente = date('Y-m-d H:i:s', time() - 30 * 86400);
    $publicos = publicos_do_gestor();
    foreach (pecas_do_gestor() as $c) {
        $lista[GR_PREFIXO_LOJA . $c['id']] = [
            'linha' => linha_do_catalogo($c),
            'foto' => 'api/guarda-roupa.php?acao=foto-catalogo&id=' . (int) $c['id'] . '&v=' . substr((string) $c['arquivo'], 0, 8),
            'novo' => (string) $c['criado_em'] >= $recente,
            'publico' => $publicos[(int) $c['id']] ?? publico_da_marca('', (string) $c['tipo']),
        ];
    }
    // As peças da coleção Rauber vêm primeiro
    return pecas_da_colecao() + $lista;
}

function catalogo(): void
{
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $minhas = [];
    foreach (consultar(
        "SELECT p.id, p.arquivo, e.peca_id AS excluida FROM pecas p LEFT JOIN pecas_excluidas e ON e.peca_id = p.id
         WHERE p.usuario_id = ? AND p.arquivo LIKE 'catalogo:%'",
        [$id]
    )->fetchAll() as $p) {
        $minhas[substr((string) $p['arquivo'], strlen(GR_PREFIXO_SUGERIDA))] = $p['excluida'] !== null ? 'excluida' : 'tem';
    }
    $itens = [];
    foreach (pecas_do_catalogo() as $codigo => $c) {
        $p = $c['linha'];
        $itens[] = [
            'codigo' => (string) $codigo,
            'tipo' => $p[0], 'cor' => $p[1], 'corte' => $p[2], 'tecido' => $p[3], 'formalidade' => $p[4], 'clima' => $p[5],
            'nome' => $p[6],
            'foto' => $c['foto'],
            'novo' => $c['novo'],
            'colecao' => $c['colecao'] ?? null,
            'publico' => $c['publico'],
            'situacao' => $minhas[(string) $codigo] ?? 'livre',
        ];
    }
    responder(200, ['itens' => $itens]);
}

function do_catalogo(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $codigo = is_string($dados['codigo'] ?? null) ? $dados['codigo'] : '';
    $catalogo = pecas_do_catalogo();
    if (!isset($catalogo[$codigo])) {
        falhar(404, 'Esta peça não está mais no catálogo.');
    }
    $limite = chave_limite('do-catalogo', (string) $id);
    exigir_limite($limite, 120, 3600);
    contar_tentativa($limite);
    $existente = consultar('SELECT id FROM pecas WHERE usuario_id = ? AND arquivo = ?', [$id, GR_PREFIXO_SUGERIDA . $codigo])->fetchColumn();
    if ($existente !== false) {
        // Já teve: se estava em Excluídas, volta
        consultar('DELETE FROM pecas_excluidas WHERE peca_id = ? AND usuario_id = ?', [(int) $existente, $id]);
        $peca = consultar('SELECT * FROM pecas WHERE id = ?', [(int) $existente])->fetch();
        responder(200, ['peca' => peca_com_preco($peca)]);
    }
    if ((int) consultar("SELECT COUNT(*) FROM pecas WHERE usuario_id = ? AND arquivo LIKE 'catalogo:%'", [$id])->fetchColumn() >= GR_MAXIMO_CATALOGO) {
        falhar(422, 'Você já tem muitas peças do catálogo. Apague de vez algumas em Excluídas.');
    }
    consultar('DELETE FROM pecas_sugeridas_recebidas WHERE usuario_id = ? AND codigo = ?', [$id, $codigo]);
    $novo = entregar_peca($id, $codigo, $catalogo[$codigo]['linha']);
    if ($novo === null) {
        falhar(409, 'Esta peça já está no seu guarda-roupa.');
    }
    registrar_evento($id, 'peca_do_catalogo', null, mb_substr($codigo, 0, 40));
    $peca = consultar('SELECT * FROM pecas WHERE id = ?', [$novo])->fetch();
    responder(201, ['peca' => peca_com_preco($peca)]);
}

/* --- Catálogo: o gestor cadastra peças para todo mundo ------------------------------------------ */

function exigir_gestor_catalogo(): array
{
    $usuario = exigir_login();
    if ((int) $usuario['admin'] !== 1) {
        falhar(403, 'Sem permissão.');
    }
    return $usuario;
}

function pasta_fotos_catalogo(): string
{
    $pasta = (string) (config()['pasta_fotos_catalogo'] ?? (__DIR__ . '/fotos-catalogo'));
    if (!is_dir($pasta) && !mkdir($pasta, 0755, true) && !is_dir($pasta)) {
        throw new RuntimeException('Não foi possível criar a pasta das fotos do catálogo.');
    }
    if (!is_file($pasta . '/.htaccess')) {
        file_put_contents($pasta . '/.htaccess', "Require all denied\n");
    }
    return $pasta;
}

function foto_catalogo(): void
{
    $c = consultar('SELECT arquivo FROM catalogo_pecas WHERE id = ?', [(int) ($_GET['id'] ?? 0)])->fetch();
    $arquivo = $c ? (string) $c['arquivo'] : '';
    $caminho = pasta_fotos_catalogo() . '/' . basename($arquivo);
    if (preg_match('/^[a-f0-9]{32}\.(webp|png)$/', $arquivo, $m) !== 1 || !is_file($caminho)) {
        header('Content-Type: text/plain; charset=utf-8');
        http_response_code(404);
        exit;
    }
    header_remove('Cache-Control');
    header('Content-Type: ' . ($m[1] === 'webp' ? 'image/webp' : 'image/png'));
    header('Cache-Control: public, max-age=2592000');
    header('Content-Length: ' . filesize($caminho));
    readfile($caminho);
    exit;
}

function peca_do_catalogo_publica(array $c): array
{
    return [
        'id' => (int) $c['id'],
        'codigo' => GR_PREFIXO_LOJA . $c['id'],
        'tipo' => $c['tipo'], 'cor' => $c['cor'], 'corte' => $c['corte'], 'tecido' => $c['tecido'],
        'formalidade' => $c['formalidade'], 'clima' => $c['clima'], 'nome' => $c['nome'],
        'automatica' => (int) $c['automatica'] === 1,
        'ativa' => (int) $c['ativa'] === 1,
        'publico' => publicos_do_gestor()[(int) $c['id']] ?? publico_da_marca('', (string) $c['tipo']),
        'foto' => 'api/guarda-roupa.php?acao=foto-catalogo&id=' . (int) $c['id'] . '&v=' . substr((string) $c['arquivo'], 0, 8),
        'pessoas' => (int) consultar("SELECT COUNT(*) FROM pecas p WHERE p.arquivo = ? AND p.id NOT IN (SELECT peca_id FROM pecas_excluidas)", [GR_PREFIXO_SUGERIDA . GR_PREFIXO_LOJA . $c['id']])->fetchColumn(),
        'criadoEm' => substr((string) $c['criado_em'], 0, 10),
    ];
}

function catalogo_gestor(): void
{
    exigir_gestor_catalogo();
    $pecas = consultar('SELECT * FROM catalogo_pecas ORDER BY ativa DESC, id DESC')->fetchAll();
    responder(200, [
        'pecas' => array_map('peca_do_catalogo_publica', $pecas),
        'daMarca' => count(GR_SUGERIDAS) + count(GR_CATALOGO),
    ]);
}

// A foto vai para uma tela de 1000 × 1250 com fundo transparente, como as peças da marca
function guardar_foto_catalogo(string $temporario): string
{
    $info = @getimagesize($temporario);
    if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        falhar(422, 'Envie uma foto em JPG, PNG ou WebP.', ['campos' => ['foto' => 'Este arquivo não é uma foto válida.']]);
    }
    if (max($info[0], $info[1]) > 4000 || min($info[0], $info[1]) < GR_MENOR_LADO) {
        falhar(422, 'O tamanho desta foto não é aceito.', ['campos' => ['foto' => 'Use uma foto de até 4000 pixels de lado.']]);
    }
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('A hospedagem não tem a biblioteca de imagens (GD).');
    }
    $original = @imagecreatefromstring((string) file_get_contents($temporario));
    if ($original === false) {
        falhar(422, 'Não foi possível abrir esta foto.', ['campos' => ['foto' => 'Não foi possível abrir esta foto.']]);
    }
    imagepalettetotruecolor($original);
    $w = imagesx($original);
    $h = imagesy($original);
    $escala = min(940 / $w, 1180 / $h);
    $nw = max(1, (int) round($w * $escala));
    $nh = max(1, (int) round($h * $escala));
    $tela = imagecreatetruecolor(1000, 1250);
    imagealphablending($tela, false);
    imagesavealpha($tela, true);
    imagefill($tela, 0, 0, imagecolorallocatealpha($tela, 0, 0, 0, 127));
    imagealphablending($tela, true);
    imagecopyresampled($tela, $original, (int) ((1000 - $nw) / 2), (int) ((1250 - $nh) / 2), 0, 0, $nw, $nh, $w, $h);
    imagealphablending($tela, false);
    $nome = bin2hex(random_bytes(16));
    $pasta = pasta_fotos_catalogo();
    $arquivo = null;
    if (function_exists('imagewebp') && @imagewebp($tela, $pasta . '/' . $nome . '.webp', 86)) {
        $arquivo = $nome . '.webp';
    } elseif (@imagepng($tela, $pasta . '/' . $nome . '.png', 8)) {
        $arquivo = $nome . '.png';
    }
    imagedestroy($original);
    imagedestroy($tela);
    if ($arquivo === null) {
        throw new RuntimeException('Não foi possível guardar a foto do catálogo.');
    }
    return $arquivo;
}

function catalogo_salvar(): void
{
    conferir_post_do_site();
    $usuario = exigir_gestor_catalogo();
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    $descricao = validar_descricao($_POST);
    $nome = texto($_POST, 'nome', 60);
    if (mb_strlen($nome) < 2) {
        falhar(422, 'Confira os campos marcados.', ['campos' => ['nome' => 'Dê um nome para a peça.']]);
    }
    $automatica = ($_POST['automatica'] ?? '') === '1' ? 1 : 0;
    $id = (int) ($_POST['id'] ?? 0);
    $atual = $id > 0 ? consultar('SELECT * FROM catalogo_pecas WHERE id = ?', [$id])->fetch() : null;
    if ($id > 0 && !$atual) {
        falhar(404, 'Peça não encontrada.');
    }
    if (!$atual && (int) consultar('SELECT COUNT(*) FROM catalogo_pecas')->fetchColumn() >= GR_MAXIMO_CATALOGO) {
        falhar(422, 'O catálogo chegou ao limite de ' . GR_MAXIMO_CATALOGO . ' peças.');
    }
    $foto = $_FILES['foto'] ?? null;
    $erro = is_array($foto) && is_int($foto['error'] ?? null) ? $foto['error'] : UPLOAD_ERR_NO_FILE;
    if ($erro === UPLOAD_ERR_INI_SIZE || $erro === UPLOAD_ERR_FORM_SIZE || ($erro === UPLOAD_ERR_OK && (int) $foto['size'] > GR_MAXIMO_BYTES * 2)) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    $arquivo = null;
    if ($erro === UPLOAD_ERR_OK && is_uploaded_file((string) $foto['tmp_name'])) {
        $arquivo = guardar_foto_catalogo((string) $foto['tmp_name']);
    } elseif (!$atual) {
        falhar(422, 'Escolha a foto da peça.', ['campos' => ['foto' => 'Escolha a foto da peça.']]);
    }
    $momento = agora();
    if ($atual) {
        consultar(
            'UPDATE catalogo_pecas SET tipo = ?, cor = ?, corte = ?, tecido = ?, formalidade = ?, clima = ?, nome = ?, automatica = ?, arquivo = ?, atualizado_em = ? WHERE id = ?',
            [$descricao['tipo'], $descricao['cor'], $descricao['corte'], $descricao['tecido'], $descricao['formalidade'], $descricao['clima'], $nome, $automatica, $arquivo ?? $atual['arquivo'], $momento, $id]
        );
        // As peças que as pessoas já têm continuam com a descrição delas; a foto nova aparece para todos.
        // A foto antiga fica guardada: pode estar em cache no aparelho de alguém.
    } else {
        consultar(
            'INSERT INTO catalogo_pecas (tipo, cor, corte, tecido, formalidade, clima, nome, arquivo, automatica, ativa, criado_por, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
            [$descricao['tipo'], $descricao['cor'], $descricao['corte'], $descricao['tecido'], $descricao['formalidade'], $descricao['clima'], $nome, $arquivo, $automatica, (int) $usuario['id'], $momento, $momento]
        );
        $id = (int) banco()->lastInsertId();
    }
    // Para quem é a peça: masculino, feminino ou para todos
    $publico = in_array($_POST['publico'] ?? '', GR_PUBLICOS, true) ? $_POST['publico'] : publico_da_marca('', $descricao['tipo']);
    try {
        consultar('DELETE FROM catalogo_publico WHERE catalogo_id = ?', [$id]);
        consultar('INSERT INTO catalogo_publico (catalogo_id, publico) VALUES (?, ?)', [$id, $publico]);
    } catch (PDOException $erro) {
        // Banco ainda sem a tabela: vale o tipo da peça
    }
    $c = consultar('SELECT * FROM catalogo_pecas WHERE id = ?', [$id])->fetch();
    responder($atual ? 200 : 201, ['peca' => peca_do_catalogo_publica($c)]);
}

function catalogo_ativar(): void
{
    $dados = exigir_post();
    exigir_gestor_catalogo();
    $id = (int) ($dados['id'] ?? 0);
    if (!consultar('SELECT 1 FROM catalogo_pecas WHERE id = ?', [$id])->fetchColumn()) {
        falhar(404, 'Peça não encontrada.');
    }
    consultar('UPDATE catalogo_pecas SET ativa = ?, atualizado_em = ? WHERE id = ?', [($dados['ativa'] ?? false) === true ? 1 : 0, agora(), $id]);
    $c = consultar('SELECT * FROM catalogo_pecas WHERE id = ?', [$id])->fetch();
    responder(200, ['peca' => peca_do_catalogo_publica($c)]);
}

function peca_publica(array $p, ?int $preco = null): array
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
        'comprimento' => comprimento_da_peca((int) $p['id'], (int) $p['usuario_id']),
        'fundoRemovido' => (int) $p['fundo_removido'] === 1,
        'sugerida' => eh_sugerida($p),
        'foto' => foto_da_peca($p),
        'criadoEm' => substr((string) $p['criado_em'], 0, 10),
        'preco' => $preco,
    ];
}

/* --- Foto achada na internet ------------------------------------------------------------------ */

/**
 * O serviço de busca ligado no config.php: a SerpApi (imagens do Google), se tiver a chave,
 * senão a Brave. Sem nenhuma chave, a busca fica desligada e o botão some.
 */
function servico_da_busca(): ?array
{
    $serpapi = trim((string) (config()['serpapi_chave'] ?? ''));
    if ($serpapi !== '') {
        return ['nome' => 'serpapi', 'chave' => $serpapi];
    }
    $brave = trim((string) (config()['brave_busca'] ?? ''));
    return $brave !== '' ? ['nome' => 'brave', 'chave' => $brave] : null;
}

function chave_da_busca(): string
{
    $servico = servico_da_busca();
    return $servico ? $servico['chave'] : '';
}

// As imagens que o site aceita trazer são só as que a busca devolveu: cada uma leva uma assinatura
function segredo_da_busca(): string
{
    $s = ajuste('segredo_busca_foto', '');
    if (!is_string($s) || strlen($s) < 32) {
        $s = bin2hex(random_bytes(32));
        gravar_ajuste('segredo_busca_foto', $s);
    }
    return $s;
}

function assinar_endereco(string $url): string
{
    return substr(hash_hmac('sha256', $url, segredo_da_busca()), 0, 40);
}

function endereco_https(string $url): bool
{
    // Só https; nos testes locais, o servidor falso responde em http
    $esquema = !empty(config()['teste_permitir_endereco_local']) ? 'https?' : 'https';
    return strlen($url) <= 1500 && preg_match('~^' . $esquema . '://[^\s/?#]+[^\s]*$~i', $url) === 1;
}

/**
 * A pessoa descreve a peça ("suéter vermelho gola V") e recebe fotos de produto.
 * O fundo branco vai na pesquisa sem aparecer para ela, para as fotos saírem parecidas com as do catálogo.
 */
function buscar_foto(): void
{
    $usuario = exigir_login();
    $chave = chave_da_busca();
    if ($chave === '') {
        falhar(503, 'A busca de fotos ainda não está ligada. Tire uma foto da peça ou escolha no catálogo.', ['semBusca' => true]);
    }
    $termo = trim(preg_replace('/\s+/', ' ', (string) ($_GET['q'] ?? '')));
    if (mb_strlen($termo) < 3 || mb_strlen($termo) > 80) {
        falhar(422, 'Escreva a peça e a cor, como "suéter vermelho".');
    }
    $limite = chave_limite('buscar-foto', (string) $usuario['id']);
    exigir_limite($limite, 40, 3600);
    contar_tentativa($limite);

    $servico = servico_da_busca();
    // O fundo branco vai na pesquisa sem aparecer para a pessoa
    $pesquisa = $termo . ' roupa fundo branco foto produto';
    if ($servico['nome'] === 'serpapi') {
        $base = rtrim((string) (config()['serpapi_endereco'] ?? 'https://serpapi.com'), '/');
        $url = $base . '/search.json?' . http_build_query([
            'engine' => 'google_images', 'q' => $pesquisa, 'hl' => 'pt-br', 'gl' => 'br', 'safe' => 'active', 'api_key' => $servico['chave'],
        ]);
        $cabecalhos = ['Accept: application/json'];
    } else {
        $base = rtrim((string) (config()['brave_endereco'] ?? 'https://api.search.brave.com'), '/');
        $url = $base . '/res/v1/images/search?' . http_build_query([
            'q' => $pesquisa, 'count' => GR_BUSCA_RESULTADOS, 'safesearch' => 'strict', 'country' => 'BR',
        ]);
        $cabecalhos = ['Accept: application/json', 'X-Subscription-Token: ' . $servico['chave']];
    }
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => $cabecalhos,
    ]);
    $corpo = curl_exec($c);
    $codigo = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    curl_close($c);
    $dados = is_string($corpo) ? json_decode($corpo, true) : null;
    if ($codigo !== 200 || !is_array($dados)) {
        // A SerpApi explica o problema no campo "error" (chave errada, buscas do mês acabaram)
        error_log('Busca de fotos (' . $servico['nome'] . '): resposta ' . $codigo . (is_array($dados) && isset($dados['error']) ? ' - ' . mb_substr((string) $dados['error'], 0, 160) : ''));
        falhar(502, $codigo === 429 ? 'Muitas buscas agora. Tente de novo mais tarde.' : 'A busca de fotos não respondeu agora. Tente de novo em instantes.');
    }
    // Cada serviço devolve as imagens num formato: aqui viram miniatura, original, título e origem
    $resultados = [];
    if ($servico['nome'] === 'serpapi') {
        foreach ((is_array($dados['images_results'] ?? null) ? $dados['images_results'] : []) as $r) {
            $resultados[] = [(string) ($r['thumbnail'] ?? ''), (string) ($r['original'] ?? ''), (string) ($r['title'] ?? ''), (string) ($r['source'] ?? '')];
        }
    } else {
        foreach ((is_array($dados['results'] ?? null) ? $dados['results'] : []) as $r) {
            $resultados[] = [(string) ($r['thumbnail']['src'] ?? ''), (string) ($r['properties']['url'] ?? ''), (string) ($r['title'] ?? ''), (string) ($r['source'] ?? ($r['meta_url']['hostname'] ?? ''))];
        }
    }
    $fotos = [];
    foreach ($resultados as [$miniatura, $original, $titulo, $origem]) {
        if (!endereco_https($miniatura)) {
            continue;
        }
        $foto = [
            'miniatura' => $miniatura,
            'assinaturaMiniatura' => assinar_endereco($miniatura),
            'titulo' => mb_substr(trim($titulo), 0, 90),
            'origem' => mb_substr($origem, 0, 60),
        ];
        if (endereco_https($original)) {
            $foto['original'] = $original;
            $foto['assinaturaOriginal'] = assinar_endereco($original);
        }
        $fotos[] = $foto;
        if (count($fotos) >= GR_BUSCA_RESULTADOS) {
            break;
        }
    }
    responder(200, ['fotos' => $fotos]);
}

// Endereço da internet pública: não deixa a busca apontar para a rede interna do servidor
function ip_publico(string $host): ?string
{
    $ips = @gethostbynamel($host);
    if (!$ips) {
        return null;
    }
    foreach ($ips as $ip) {
        $local = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
        if (!$local || !empty(config()['teste_permitir_endereco_local'])) {
            return $ip;
        }
    }
    return null;
}

/** Traz a imagem escolhida para o navegador da pessoa poder tirar o fundo. Nada fica guardado aqui. */
function foto_web(): void
{
    $usuario = exigir_login();
    $url = (string) ($_GET['u'] ?? '');
    $assinatura = (string) ($_GET['a'] ?? '');
    if (!endereco_https($url) || !hash_equals(assinar_endereco($url), $assinatura)) {
        falhar(404, 'Foto não encontrada.');
    }
    $limite = chave_limite('foto-web', (string) $usuario['id']);
    exigir_limite($limite, 120, 3600);
    contar_tentativa($limite);

    $partes = parse_url($url);
    $host = (string) ($partes['host'] ?? '');
    $porta = (int) ($partes['port'] ?? (strtolower((string) ($partes['scheme'] ?? '')) === 'http' ? 80 : 443));
    $ip = $host !== '' ? ip_publico($host) : null;
    if ($ip === null) {
        falhar(404, 'Foto não encontrada.');
    }
    $recebido = '';
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => !empty(config()['teste_permitir_endereco_local']) ? (CURLPROTO_HTTP | CURLPROTO_HTTPS) : CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Accept: image/webp,image/jpeg,image/png,image/*;q=0.8', 'User-Agent: Mozilla/5.0 (compatible; RauberDigitalCloset/1.0)'],
        CURLOPT_WRITEFUNCTION => function ($h, string $pedaco) use (&$recebido): int {
            $recebido .= $pedaco;
            return strlen($recebido) > GR_FOTO_WEB_BYTES ? 0 : strlen($pedaco);
        },
    ]);
    if (empty(config()['teste_permitir_endereco_local'])) {
        // O endereço conferido é o usado na conexão
        curl_setopt($c, CURLOPT_RESOLVE, [$host . ':' . $porta . ':' . $ip]);
    } else {
        curl_setopt($c, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($c, CURLOPT_SSL_VERIFYHOST, 0);
    }
    curl_exec($c);
    $codigo = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    curl_close($c);
    $info = $codigo === 200 && $recebido !== '' && strlen($recebido) <= GR_FOTO_WEB_BYTES ? @getimagesizefromstring($recebido) : false;
    $tipos = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp', IMAGETYPE_GIF => 'image/gif'];
    if ($info === false || !isset($tipos[$info[2]])) {
        falhar(404, 'Não foi possível trazer esta foto. Escolha outra.');
    }
    header_remove('Cache-Control');
    header('Cache-Control: private, max-age=600');
    header('Content-Type: ' . $tipos[$info[2]]);
    header("Content-Security-Policy: default-src 'none'");
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . strlen($recebido));
    echo $recebido;
    exit;
}

/* --- Comprimento das peças de cima (tabela à parte, criada no primeiro uso) ------------------- */

function garantir_tabela_extras(): void
{
    static $feito = false;
    if (!$feito) {
        consultar('CREATE TABLE IF NOT EXISTS pecas_extras (peca_id INT UNSIGNED NOT NULL PRIMARY KEY, comprimento VARCHAR(12) NOT NULL DEFAULT \'\')');
        $feito = true;
    }
}

/** O comprimento guardado de cada peça da pessoa ('' quando não informado). */
function comprimento_da_peca(int $pecaId, int $usuarioId, ?string $novo = null): string
{
    static $mapas = [];
    if ($novo !== null) {
        garantir_tabela_extras();
        consultar('DELETE FROM pecas_extras WHERE peca_id = ?', [$pecaId]);
        if ($novo !== '') {
            consultar('INSERT INTO pecas_extras (peca_id, comprimento) VALUES (?, ?)', [$pecaId, $novo]);
        }
        if (isset($mapas[$usuarioId])) {
            $mapas[$usuarioId][$pecaId] = $novo;
        }
        return $novo;
    }
    if (!isset($mapas[$usuarioId])) {
        $mapas[$usuarioId] = [];
        try {
            foreach (consultar('SELECT e.peca_id, e.comprimento FROM pecas_extras e JOIN pecas p ON p.id = e.peca_id WHERE p.usuario_id = ?', [$usuarioId])->fetchAll() as $l) {
                $mapas[$usuarioId][(int) $l['peca_id']] = (string) $l['comprimento'];
            }
        } catch (PDOException $erro) {
            // Tabela ainda não criada: nenhuma peça tem comprimento
        }
    }
    return $mapas[$usuarioId][$pecaId] ?? '';
}

function precos_da_pessoa(int $id): array
{
    $mapa = [];
    foreach (consultar('SELECT peca_id, preco_centavos FROM pecas_valores WHERE usuario_id = ?', [$id])->fetchAll() as $linha) {
        $mapa[(int) $linha['peca_id']] = (int) $linha['preco_centavos'];
    }
    return $mapa;
}

function peca_com_preco(array $p): array
{
    $preco = consultar('SELECT preco_centavos FROM pecas_valores WHERE peca_id = ?', [(int) $p['id']])->fetchColumn();
    return peca_publica($p, $preco === false ? null : (int) $preco);
}

function uso_publico(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'data' => (string) $u['dia'],
        'pecas' => array_map('intval', explode('-', (string) $u['chave'])),
        'ocasiao' => $u['ocasiao'],
        'observacao' => $u['observacao'],
    ];
}

function listar(): void
{
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecas = consultar(
        'SELECT * FROM pecas WHERE usuario_id = ? AND id NOT IN (SELECT peca_id FROM pecas_excluidas WHERE usuario_id = ?) ORDER BY id DESC',
        [$id, $id]
    )->fetchAll();
    $excluidas = consultar(
        'SELECT p.* FROM pecas p JOIN pecas_excluidas e ON e.peca_id = p.id WHERE p.usuario_id = ? ORDER BY e.excluida_em DESC, p.id DESC',
        [$id]
    )->fetchAll();
    $looks = consultar('SELECT chave, situacao FROM looks WHERE usuario_id = ? ORDER BY id DESC', [$id])->fetchAll();
    $notas = consultar('SELECT chave, nome, observacao FROM looks_notas WHERE usuario_id = ?', [$id])->fetchAll();
    $usos = consultar('SELECT * FROM usos_pecas WHERE usuario_id = ? ORDER BY dia DESC, id DESC', [$id])->fetchAll();
    $precos = precos_da_pessoa($id);
    $comPreco = function (array $p) use ($precos): array {
        return peca_publica($p, $precos[(int) $p['id']] ?? null);
    };
    responder(200, [
        'pecas' => array_map($comPreco, $pecas),
        'excluidas' => array_map($comPreco, $excluidas),
        'usos' => array_map('uso_publico', $usos),
        'looks' => $looks,
        'notas' => $notas,
        'maximoPecas' => GR_MAXIMO_PECAS,
        'consentiu' => $usuario['consentiu_em'] !== null,
        'compradas' => pecas_compradas($id),
        'buscaDeFotos' => chave_da_busca() !== '',
    ]);
}

// Peças da coleção que a pessoa já pediu (não sugere de novo). Pedido cancelado não conta.
function pecas_compradas(int $id): array
{
    try {
        return consultar(
            "SELECT DISTINCT pr.slug FROM pedidos_itens i
             JOIN pedidos pe ON pe.id = i.pedido_id JOIN produtos pr ON pr.id = i.produto_id
             WHERE pe.usuario_id = ? AND pe.situacao <> 'cancelado'",
            [$id]
        )->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $erro) {
        return [];
    }
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
        'comprimento' => in_array($d['comprimento'] ?? '', GR_COMPRIMENTOS, true) ? (string) ($d['comprimento'] ?? '') : '',
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

    exigir_vaga_para_peca($id);
    if (total_pecas_proprias($id, true) >= GR_MAXIMO_COM_EXCLUIDAS) {
        falhar(422, 'Seu guarda-roupa está cheio. Apague de vez algumas peças em Excluídas para adicionar outras.');
    }

    // O cadastro de várias peças envia até 20 fotos de cada vez
    $limite = chave_limite('peca', (string) $id);
    exigir_limite($limite, 80, 3600);
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
    if ($descricao['comprimento'] !== '') {
        comprimento_da_peca($novoId, $id, $descricao['comprimento']);
    }
    registrar_evento($id, 'peca_adicionada', null, $descricao['tipo']);
    $preco = preco_valido($_POST['preco'] ?? null);
    if ($preco !== null && $preco > 0) {
        definir_preco($novoId, $id, $preco);
    }

    $peca = consultar('SELECT * FROM pecas WHERE id = ?', [$novoId])->fetch();
    responder(201, ['peca' => peca_com_preco($peca)]);
}

// As peças sugeridas não ocupam o limite, porque a foto delas é da marca
function total_pecas_proprias(int $id, bool $comExcluidas): int
{
    $sql = 'SELECT COUNT(*) FROM pecas WHERE usuario_id = ? AND arquivo NOT LIKE ?';
    $valores = [$id, GR_PREFIXO_SUGERIDA . '%'];
    if (!$comExcluidas) {
        $sql .= ' AND id NOT IN (SELECT peca_id FROM pecas_excluidas WHERE usuario_id = ?)';
        $valores[] = $id;
    }
    return (int) consultar($sql, $valores)->fetchColumn();
}

function exigir_vaga_para_peca(int $id): void
{
    if (total_pecas_proprias($id, false) >= GR_MAXIMO_PECAS) {
        falhar(422, 'Você chegou ao limite de ' . GR_MAXIMO_PECAS . ' peças suas. Exclua uma para adicionar outra.');
    }
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
    if (array_key_exists('comprimento', $dados)) {
        comprimento_da_peca($pecaId, $id, $d['comprimento']);
    }
    if (array_key_exists('preco', $dados)) {
        $preco = preco_valido($dados['preco']);
        if ($preco === null) {
            falhar(422, 'Confira os campos marcados.', ['campos' => ['preco' => 'Informe o valor em reais, como 189,90.']]);
        }
        definir_preco($pecaId, $id, $preco);
    }
    responder(200, ['peca' => peca_com_preco(peca_da_pessoa($pecaId, $id))]);
}

function excluir(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);
    marcar_excluida($pecaId, $id);
    registrar_evento($id, 'peca_excluida', null, (string) $peca['tipo']);
    responder(200);
}

// Os looks com a peça continuam guardados: voltam com ela se a pessoa a adicionar de novo
function marcar_excluida(int $pecaId, int $id): void
{
    $jaEsta = consultar('SELECT peca_id FROM pecas_excluidas WHERE peca_id = ?', [$pecaId])->fetchColumn();
    if ($jaEsta === false) {
        consultar('INSERT INTO pecas_excluidas (peca_id, usuario_id, excluida_em) VALUES (?, ?, ?)', [$pecaId, $id, agora()]);
    }
}

function excluir_sugeridas(): void
{
    exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $ids = consultar(
        'SELECT id FROM pecas WHERE usuario_id = ? AND arquivo LIKE ?',
        [$id, GR_PREFIXO_SUGERIDA . '%']
    )->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $pecaId) {
        marcar_excluida((int) $pecaId, $id);
    }
    responder(200);
}

function restaurar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);
    if (!eh_sugerida($peca)) {
        exigir_vaga_para_peca($id);
    }
    consultar('DELETE FROM pecas_excluidas WHERE peca_id = ? AND usuario_id = ?', [$pecaId, $id]);
    registrar_evento($id, 'peca_restaurada', null, (string) $peca['tipo']);
    responder(200, ['peca' => peca_com_preco($peca)]);
}

function apagar(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);
    if (eh_sugerida($peca)) {
        falhar(422, 'As peças sugeridas ficam em Excluídas, caso você queira adicioná-las de novo.');
    }
    $estaExcluida = consultar('SELECT peca_id FROM pecas_excluidas WHERE peca_id = ?', [$pecaId])->fetchColumn();
    if ($estaExcluida === false) {
        falhar(409, 'Exclua a peça antes de apagá-la de vez.');
    }

    // Look que usava esta peça deixa de existir, com o nome e a observação dele
    foreach (['looks', 'looks_notas'] as $tabela) {
        $linhas = consultar("SELECT id, chave FROM $tabela WHERE usuario_id = ?", [$id])->fetchAll();
        foreach ($linhas as $linha) {
            if (in_array((string) $pecaId, explode('-', (string) $linha['chave']), true)) {
                consultar("DELETE FROM $tabela WHERE id = ?", [$linha['id']]);
            }
        }
    }
    // No diário, a anotação fica com as outras peças; sem nenhuma, sai
    $usos = consultar('SELECT id, chave FROM usos_pecas WHERE usuario_id = ?', [$id])->fetchAll();
    foreach ($usos as $uso) {
        $ids = explode('-', (string) $uso['chave']);
        if (!in_array((string) $pecaId, $ids, true)) {
            continue;
        }
        $resto = array_values(array_diff($ids, [(string) $pecaId]));
        if ($resto) {
            consultar('UPDATE usos_pecas SET chave = ? WHERE id = ?', [implode('-', $resto), $uso['id']]);
        } else {
            consultar('DELETE FROM usos_pecas WHERE id = ?', [$uso['id']]);
        }
    }
    consultar('DELETE FROM pecas_valores WHERE peca_id = ?', [$pecaId]);
    consultar('DELETE FROM pecas_excluidas WHERE peca_id = ?', [$pecaId]);
    consultar('DELETE FROM pecas WHERE id = ?', [$pecaId]);
    apagar_foto((string) $peca['arquivo']);
    registrar_evento($id, 'peca_apagada', null, (string) $peca['tipo']);
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

/* --- Foto nova para uma peça que já existe ------------------------------------------------ */

function foto_enviada(): string
{
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
    return (string) $foto['tmp_name'];
}

// A peça sugerida que ganha uma foto da pessoa passa a ser dela e conta no limite
function trocar_foto(): void
{
    conferir_post_do_site();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        falhar(413, 'A foto é grande demais para enviar.');
    }
    $pecaId = (int) ($_POST['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);
    if ($usuario['consentiu_em'] === null) {
        if (($_POST['consentimento'] ?? '') !== '1') {
            falhar(403, 'Para continuar, é preciso concordar com a política de privacidade.');
        }
        consultar('UPDATE usuarios SET consentiu_em = ? WHERE id = ?', [agora(), $id]);
    }
    $eraSugerida = eh_sugerida($peca);
    if ($eraSugerida) {
        exigir_vaga_para_peca($id);
        if (total_pecas_proprias($id, true) >= GR_MAXIMO_COM_EXCLUIDAS) {
            falhar(422, 'Seu guarda-roupa está cheio. Apague de vez algumas peças em Excluídas para adicionar outras.');
        }
    }
    $limite = chave_limite('peca', (string) $id);
    exigir_limite($limite, 80, 3600);
    contar_tentativa($limite);

    $arquivo = guardar_foto(foto_enviada());
    $fundoRemovido = ($_POST['fundo_removido'] ?? '') === '1' ? 1 : 0;
    consultar('UPDATE pecas SET arquivo = ?, fundo_removido = ?, atualizado_em = ? WHERE id = ?', [$arquivo, $fundoRemovido, agora(), $pecaId]);
    if (!$eraSugerida) {
        apagar_foto((string) $peca['arquivo']);
    }
    registrar_evento($id, 'peca_foto_trocada', null, (string) $peca['tipo']);
    responder(200, ['peca' => peca_com_preco(peca_da_pessoa($pecaId, $id))]);
}

/* --- Preço pago -------------------------------------------------------------------------- */

// Centavos, até R$ 50.000. Zero ou vazio apaga o preço. Devolve null se for inválido.
function preco_valido($valor): ?int
{
    if ($valor === '' || $valor === null) {
        return 0;
    }
    if (is_string($valor) && preg_match('/^\d{1,7}$/', $valor) === 1) {
        $valor = (int) $valor;
    }
    if (!is_int($valor) || $valor < 0 || $valor > GR_MAIOR_PRECO) {
        return null;
    }
    return $valor;
}

function definir_preco(int $pecaId, int $usuarioId, int $centavos): void
{
    consultar('DELETE FROM pecas_valores WHERE peca_id = ?', [$pecaId]);
    if ($centavos > 0) {
        consultar('INSERT INTO pecas_valores (peca_id, usuario_id, preco_centavos) VALUES (?, ?, ?)', [$pecaId, $usuarioId, $centavos]);
    }
}

function guardar_preco(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $pecaId = (int) ($dados['id'] ?? 0);
    $peca = peca_da_pessoa($pecaId, $id);
    $preco = preco_valido($dados['preco'] ?? null);
    if ($preco === null) {
        falhar(422, 'Informe o valor em reais, como 189,90.', ['campos' => ['preco' => 'Informe o valor em reais, como 189,90.']]);
    }
    definir_preco($pecaId, $id, $preco);
    responder(200, ['peca' => peca_com_preco($peca)]);
}

/* --- Diário: o que a pessoa usou ------------------------------------------------------------ */

function anotar_uso(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];

    $pecas = is_array($dados['pecas'] ?? null) ? $dados['pecas'] : [];
    $ids = array_values(array_unique(array_map('intval', array_filter($pecas, 'is_int'))));
    sort($ids);
    if (count($ids) < 1 || count($ids) > 8 || count($ids) !== count($pecas)) {
        falhar(422, 'Escolha de 1 a 8 peças.', ['campos' => ['pecas' => 'Escolha de 1 a 8 peças.']]);
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $encontradas = (int) consultar("SELECT COUNT(*) FROM pecas WHERE usuario_id = ? AND id IN ($marcas)", array_merge([$id], $ids))->fetchColumn();
    if ($encontradas !== count($ids)) {
        falhar(404, 'Peça não encontrada.');
    }

    $dia = texto($dados, 'data', 10);
    $partes = explode('-', $dia);
    $valida = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia) === 1 && checkdate((int) $partes[1], (int) $partes[2], (int) $partes[0]);
    if (!$valida || $dia > date('Y-m-d', time() + 86400) || $dia < date('Y-m-d', time() - 5 * 365 * 86400)) {
        falhar(422, 'Confira a data.', ['campos' => ['data' => 'Escolha uma data até hoje.']]);
    }

    $total = (int) consultar('SELECT COUNT(*) FROM usos_pecas WHERE usuario_id = ?', [$id])->fetchColumn();
    if ($total >= GR_MAXIMO_USOS) {
        falhar(422, 'Seu diário chegou ao limite de ' . GR_MAXIMO_USOS . ' anotações. Apague as mais antigas para continuar.');
    }
    $limite = chave_limite('uso', (string) $id);
    exigir_limite($limite, 120, 3600);
    contar_tentativa($limite);

    consultar(
        'INSERT INTO usos_pecas (usuario_id, dia, chave, ocasiao, observacao, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
        [$id, $dia, implode('-', $ids), str_replace("\n", ' ', texto($dados, 'ocasiao', 60)), str_replace("\n", ' ', texto($dados, 'observacao', 200)), agora()]
    );
    $novo = consultar('SELECT * FROM usos_pecas WHERE id = ?', [(int) banco()->lastInsertId()])->fetch();
    registrar_evento($id, 'look_usado');
    responder(201, ['uso' => uso_publico($novo)]);
}

function apagar_uso(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    $id = (int) $usuario['id'];
    $usoId = (int) ($dados['id'] ?? 0);
    $existe = consultar('SELECT id FROM usos_pecas WHERE id = ? AND usuario_id = ?', [$usoId, $id])->fetchColumn();
    if ($existe === false) {
        falhar(404, 'Anotação não encontrada.');
    }
    consultar('DELETE FROM usos_pecas WHERE id = ?', [$usoId]);
    responder(200);
}
