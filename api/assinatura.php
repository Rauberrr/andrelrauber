<?php
/**
 * Assinatura dos apps.
 *
 * O gestor escolhe no painel em que modo o site está:
 * - oculta:   os apps são grátis e a página da assinatura só aparece para o gestor (prévia);
 * - aviso:    os apps continuam grátis, e a página avisa que estão em teste e terão assinatura;
 * - cobrando: só quem tem a assinatura liberada usa os apps. Os outros vão para a página.
 *
 * GET  ?acao=publica    o plano, o modo e a situação de quem está vendo
 * POST ?acao=assinar    pedido de assinatura (o pagamento online ainda não está ligado)
 * GET  ?acao=gestor     (gestor) o plano e quem tem acesso liberado
 * POST ?acao=salvar     (gestor) modo, nome, preço e benefícios  {modo, nome, precoCentavos, beneficios[]}
 * POST ?acao=liberar    (gestor) libera o acesso de uma pessoa  {email, ate: AAAA-MM-DD ou vazio}
 * POST ?acao=revogar    (gestor) tira o acesso liberado  {usuarioId}
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

header('Cache-Control: no-store');

function exigir_gestor_assinatura(): array
{
    $usuario = exigir_login();
    if ((int) $usuario['admin'] !== 1) {
        falhar(403, 'Sem permissão.');
    }
    return $usuario;
}

function plano_publico(array $plano): array
{
    return [
        'modo' => $plano['modo'],
        'nome' => $plano['nome'],
        'precoCentavos' => $plano['precoCentavos'],
        'beneficios' => $plano['beneficios'],
    ];
}

function minha_assinatura(?array $usuario): ?array
{
    if ($usuario === null) {
        return null;
    }
    $a = assinatura_da_pessoa((int) $usuario['id']);
    return [
        'liberado' => acesso_aos_apps($usuario),
        'assinante' => $a !== null && assinatura_valida($a),
        'validaAte' => $a && $a['valida_ate'] ? substr((string) $a['valida_ate'], 0, 10) : null,
    ];
}

switch ($_GET['acao'] ?? '') {
    case 'publica':
        $usuario = usuario_logado();
        $gestor = $usuario !== null && (int) $usuario['admin'] === 1;
        $plano = assinatura_config();
        // Oculta: quem não é gestor só fica sabendo que os apps estão em teste
        if ($plano['modo'] === 'oculta' && !$gestor) {
            responder(200, ['plano' => ['modo' => 'oculta'], 'minha' => minha_assinatura($usuario), 'gestor' => false, 'logado' => $usuario !== null]);
        }
        responder(200, ['plano' => plano_publico($plano), 'minha' => minha_assinatura($usuario), 'gestor' => $gestor, 'logado' => $usuario !== null]);
        break;

    case 'assinar':
        exigir_post();
        $usuario = exigir_login();
        registrar_evento((int) $usuario['id'], 'assinatura_interesse');
        falhar(503, 'O pagamento online ainda não está ligado. Fale com a gente pelo WhatsApp para assinar.', ['whatsapp' => true]);
        break;

    case 'gestor':
        exigir_gestor_assinatura();
        $liberados = consultar(
            'SELECT a.usuario_id, a.situacao, a.valida_ate, a.origem, a.criado_em, u.nome, u.email
             FROM assinaturas a JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.atualizado_em DESC LIMIT 300'
        )->fetchAll();
        responder(200, [
            'plano' => plano_publico(assinatura_config()),
            'liberados' => array_map(function (array $a): array {
                return [
                    'usuarioId' => (int) $a['usuario_id'],
                    'nome' => $a['nome'],
                    'email' => $a['email'],
                    'validaAte' => $a['valida_ate'] ? substr((string) $a['valida_ate'], 0, 10) : null,
                    'valida' => assinatura_valida($a),
                    'origem' => $a['origem'],
                    'desde' => substr((string) $a['criado_em'], 0, 10),
                ];
            }, $liberados),
            'pessoas' => (int) consultar('SELECT COUNT(*) FROM usuarios')->fetchColumn(),
        ]);
        break;

    case 'salvar':
        $dados = exigir_post();
        $gestor = exigir_gestor_assinatura();
        $erros = [];
        $modo = $dados['modo'] ?? '';
        if (!in_array($modo, ASSINATURA_MODOS, true)) {
            $erros['modo'] = 'Escolha o modo.';
        }
        $nome = trim(texto($dados, 'nome', 60));
        if (mb_strlen($nome) < 2) {
            $erros['nome'] = 'Dê um nome ao plano.';
        }
        $preco = $dados['precoCentavos'] ?? null;
        if (!is_int($preco) || $preco < 100 || $preco > 100000) {
            $erros['preco'] = 'Use um valor entre R$ 1,00 e R$ 1.000,00.';
        }
        $beneficios = [];
        foreach (array_slice(is_array($dados['beneficios'] ?? null) ? $dados['beneficios'] : [], 0, 12) as $b) {
            $b = is_string($b) ? trim(preg_replace('/\s+/u', ' ', $b)) : '';
            if (mb_strlen($b) >= 2) {
                $beneficios[] = mb_substr($b, 0, 120);
            }
        }
        if ($erros) {
            falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
        }
        $antes = assinatura_config()['modo'];
        gravar_ajuste('assinatura', ['modo' => $modo, 'nome' => $nome, 'precoCentavos' => $preco, 'beneficios' => $beneficios ?: ASSINATURA_PADRAO['beneficios']]);
        if ($antes !== $modo) {
            registrar_evento((int) $gestor['id'], 'assinatura_modo', null, $antes . ' > ' . $modo);
        }
        responder(200, ['plano' => plano_publico(assinatura_config())]);
        break;

    case 'liberar':
        $dados = exigir_post();
        exigir_gestor_assinatura();
        $email = mb_strtolower(trim(texto($dados, 'email', 190)));
        $pessoa = $email !== '' ? consultar('SELECT id FROM usuarios WHERE email = ?', [$email])->fetch() : false;
        if (!$pessoa) {
            falhar(404, 'Nenhuma conta com este e-mail.', ['campos' => ['email' => 'Nenhuma conta com este e-mail.']]);
        }
        $ate = data_valida($dados['ate'] ?? '');
        if ($ate === false) {
            falhar(422, 'Data inválida.', ['campos' => ['ate' => 'Use uma data a partir de hoje, ou deixe em branco.']]);
        }
        $momento = agora();
        $id = (int) $pessoa['id'];
        $validaAte = $ate === null ? null : $ate . ' 23:59:59';
        if (consultar('SELECT 1 FROM assinaturas WHERE usuario_id = ?', [$id])->fetchColumn()) {
            consultar("UPDATE assinaturas SET situacao = 'ativa', valida_ate = ?, origem = 'cortesia', atualizado_em = ? WHERE usuario_id = ?", [$validaAte, $momento, $id]);
        } else {
            consultar(
                "INSERT INTO assinaturas (usuario_id, situacao, valida_ate, origem, criado_em, atualizado_em) VALUES (?, 'ativa', ?, 'cortesia', ?, ?)",
                [$id, $validaAte, $momento, $momento]
            );
        }
        responder(200);
        break;

    case 'revogar':
        $dados = exigir_post();
        exigir_gestor_assinatura();
        consultar("UPDATE assinaturas SET situacao = 'cancelada', atualizado_em = ? WHERE usuario_id = ?", [agora(), (int) ($dados['usuarioId'] ?? 0)]);
        responder(200);
        break;

    default:
        falhar(404, 'Ação desconhecida.');
}

/** null: sem prazo. false: data inválida ou no passado. */
function data_valida($valor)
{
    if ($valor === '' || $valor === null) {
        return null;
    }
    if (!is_string($valor) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $p) !== 1 || !checkdate((int) $p[2], (int) $p[3], (int) $p[1]) || $valor < date('Y-m-d')) {
        return false;
    }
    return $valor;
}
