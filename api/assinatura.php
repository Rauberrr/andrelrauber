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
 * POST ?acao=assinar    cria a assinatura no Mercado Pago e devolve o endereço da tela de pagamento
 * POST ?acao=conferir   consulta no Mercado Pago a assinatura da pessoa (na volta de lá)
 * POST ?acao=cancelar   cancela a assinatura no Mercado Pago; o acesso vai até o fim do mês pago
 * GET  ?acao=gestor     (gestor) o plano e quem tem acesso liberado
 * POST ?acao=salvar     (gestor) modo, nome, preço, dias de teste e benefícios  {modo, nome, precoCentavos, testeDias, beneficios[]}
 * POST ?acao=liberar    (gestor) libera o acesso de uma pessoa  {email, ate: AAAA-MM-DD ou vazio}
 * POST ?acao=revogar    (gestor) tira o acesso liberado  {usuarioId}
 * GET  ?acao=tarefas    (gestor) quando cada tarefa do Cron rodou pela última vez
 * POST ?acao=testador   (gestor) usuários de teste  {acao: incluir|tirar|recomecar|encerrar, email ou usuarioId}
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/mercadopago.php';

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
        'testeDias' => $plano['testeDias'],
        'beneficios' => $plano['beneficios'],
    ];
}

function minha_assinatura(?array $usuario): ?array
{
    if ($usuario === null) {
        return null;
    }
    $a = assinatura_da_pessoa((int) $usuario['id']);
    $plano = assinatura_config();
    $fim = modo_para($usuario, $plano) === 'cobrando' && !ja_usava_antes($usuario, $plano) ? fim_do_teste($usuario, $plano) : null;
    $emTeste = $fim !== null && $fim > date('Y-m-d H:i:s');
    return [
        'liberado' => acesso_aos_apps($usuario),
        'assinante' => $a !== null && assinatura_valida($a),
        'validaAte' => $a && $a['valida_ate'] ? substr((string) $a['valida_ate'], 0, 10) : null,
        'emTeste' => $emTeste,
        'testeAcabou' => $fim !== null && !$emTeste,
        'diasDeTeste' => $emTeste ? max(1, (int) ceil((strtotime($fim) - time()) / 86400)) : 0,
        'jaUsava' => ja_usava_antes($usuario, $plano),
        'mercadoPago' => assinatura_mp_da_pessoa((int) $usuario['id']),
        'testador' => testador_desde($usuario, $plano) !== null,
    ];
}

// A assinatura do Mercado Pago da pessoa: a situação e o identificador, ou null
function assinatura_mp_da_pessoa(int $usuarioId): ?array
{
    try {
        $linha = consultar("SELECT preapproval_id, status FROM assinaturas_mp WHERE usuario_id = ? AND status <> 'pending' ORDER BY atualizado_em DESC LIMIT 1", [$usuarioId])->fetch();
    } catch (PDOException $erro) {
        return null;
    }
    return $linha ? ['status' => $linha['status'], 'id' => $linha['preapproval_id']] : null;
}

function salvar_plano(array $plano): void
{
    gravar_ajuste('assinatura', [
        'modo' => $plano['modo'], 'nome' => $plano['nome'], 'precoCentavos' => $plano['precoCentavos'], 'testeDias' => $plano['testeDias'],
        'cobrandoDesde' => $plano['cobrandoDesde'], 'liberarAntigos' => $plano['liberarAntigos'], 'testadores' => array_values($plano['testadores']),
        'beneficios' => $plano['beneficios'],
    ]);
}

switch ($_GET['acao'] ?? '') {
    case 'publica':
        $usuario = usuario_logado();
        $gestor = $usuario !== null && (int) $usuario['admin'] === 1;
        $plano = assinatura_config();
        // O usuário de teste vê a página como se a cobrança estivesse ligada
        $plano['modo'] = modo_para($usuario, $plano);
        // Oculta: quem não é gestor só fica sabendo que os apps estão em teste
        if ($plano['modo'] === 'oculta' && !$gestor) {
            responder(200, ['plano' => ['modo' => 'oculta'], 'minha' => minha_assinatura($usuario), 'gestor' => false, 'logado' => $usuario !== null]);
        }
        responder(200, ['plano' => plano_publico($plano), 'minha' => minha_assinatura($usuario), 'gestor' => $gestor, 'logado' => $usuario !== null]);
        break;

    case 'assinar':
        $dados = exigir_post();
        $usuario = exigir_login();
        $id = (int) $usuario['id'];
        registrar_evento($id, 'assinatura_interesse');
        $plano = assinatura_config();
        if (modo_para($usuario, $plano) !== 'cobrando') {
            falhar(409, 'Os apps estão grátis agora. Não há nada para pagar.');
        }
        $mp = assinatura_mp_da_pessoa($id);
        $a = assinatura_da_pessoa($id);
        if ($mp && $mp['status'] === 'authorized' && $a && assinatura_valida($a)) {
            falhar(409, 'Sua assinatura já está ativa.');
        }
        if (!mp_ativo()) {
            falhar(503, 'O pagamento online ainda não está ligado. Fale com a gente pelo WhatsApp para assinar.', ['whatsapp' => true]);
        }
        $limite = chave_limite('assinar', (string) $id);
        exigir_limite($limite, 10, 3600);
        contar_tentativa($limite);
        // Durante o teste grátis, a primeira cobrança fica para o dia em que o teste acaba
        $fimDoTeste = !ja_usava_antes($usuario, $plano) && em_teste($usuario) ? fim_do_teste($usuario, $plano) : null;
        $link = mp_criar_assinatura($usuario, $plano, $fimDoTeste);
        if ($link === null) {
            falhar(502, 'Não foi possível abrir o Mercado Pago agora. Tente de novo em instantes.');
        }
        responder(200, ['link' => $link]);
        break;

    case 'conferir':
        exigir_post();
        $usuario = exigir_login();
        $id = (int) $usuario['id'];
        $limite = chave_limite('conferir-assinatura', (string) $id);
        exigir_limite($limite, 30, 3600);
        contar_tentativa($limite);
        foreach (consultar('SELECT preapproval_id FROM assinaturas_mp WHERE usuario_id = ? ORDER BY atualizado_em DESC LIMIT 3', [$id])->fetchAll(PDO::FETCH_COLUMN) as $pre) {
            mp_sincronizar_assinatura((string) $pre);
        }
        $usuario = consultar('SELECT * FROM usuarios WHERE id = ?', [$id])->fetch();
        responder(200, ['minha' => minha_assinatura($usuario)]);
        break;

    case 'cancelar':
        exigir_post();
        $usuario = exigir_login();
        $mp = assinatura_mp_da_pessoa((int) $usuario['id']);
        if (!$mp || $mp['status'] !== 'authorized') {
            falhar(404, 'Não há assinatura ativa para cancelar.');
        }
        if (!mp_cancelar_assinatura($mp['id'])) {
            falhar(502, 'Não foi possível cancelar agora. Tente de novo em instantes ou cancele pelo app do Mercado Pago.');
        }
        $usuario = consultar('SELECT * FROM usuarios WHERE id = ?', [(int) $usuario['id']])->fetch();
        responder(200, ['minha' => minha_assinatura($usuario)]);
        break;

    case 'gestor':
        exigir_gestor_assinatura();
        $plano = assinatura_config();
        $liberados = consultar(
            "SELECT a.usuario_id, a.situacao, a.valida_ate, a.origem, a.criado_em, u.nome, u.email,
                    (SELECT m.status FROM assinaturas_mp m WHERE m.usuario_id = a.usuario_id AND m.status <> 'pending' ORDER BY m.atualizado_em DESC LIMIT 1) AS mp_status
             FROM assinaturas a JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.atualizado_em DESC LIMIT 300"
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
                    'mpStatus' => $a['mp_status'],
                    'desde' => substr((string) $a['criado_em'], 0, 10),
                ];
            }, $liberados),
            'pessoas' => (int) consultar('SELECT COUNT(*) FROM usuarios')->fetchColumn(),
            'liberarAntigos' => $plano['liberarAntigos'],
            'pagamentoOnline' => mp_ativo(),
            'assinantesMp' => (int) consultar("SELECT COUNT(*) FROM assinaturas_mp WHERE status = 'authorized'")->fetchColumn(),
            'cobrandoDesde' => $plano['cobrandoDesde'],
            'testadores' => array_values(array_filter(array_map(function (array $t) use ($plano) {
                $u = consultar('SELECT * FROM usuarios WHERE id = ?', [$t['id']])->fetch();
                if (!$u) {
                    return null;
                }
                $fim = fim_do_teste($u, $plano);
                $emTeste = $fim !== null && $fim > date('Y-m-d H:i:s');
                $a = assinatura_da_pessoa((int) $u['id']);
                return [
                    'usuarioId' => (int) $u['id'], 'nome' => $u['nome'], 'email' => $u['email'], 'desde' => substr($t['desde'], 0, 10),
                    'situacao' => $a && assinatura_valida($a) ? 'assinante' : ($emTeste ? 'teste' : 'bloqueado'),
                    'diasDeTeste' => $emTeste ? max(1, (int) ceil((strtotime($fim) - time()) / 86400)) : 0,
                ];
            }, $plano['testadores']))),
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
        $testeDias = $dados['testeDias'] ?? 7;
        if (!is_int($testeDias) || $testeDias < 0 || $testeDias > 60) {
            $erros['testeDias'] = 'Use de 0 a 60 dias.';
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
        $anterior = assinatura_config();
        $antes = $anterior['modo'];
        // O teste de quem já tem conta começa no dia em que a cobrança é ligada
        $desde = $modo === 'cobrando' ? ($antes === 'cobrando' && $anterior['cobrandoDesde'] ? $anterior['cobrandoDesde'] : agora()) : null;
        salvar_plano(array_merge($anterior, [
            'modo' => $modo, 'nome' => $nome, 'precoCentavos' => $preco, 'testeDias' => $testeDias, 'cobrandoDesde' => $desde,
            'liberarAntigos' => ($dados['liberarAntigos'] ?? $anterior['liberarAntigos']) === true,
            'beneficios' => $beneficios ?: ASSINATURA_PADRAO['beneficios'],
        ]));
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

    case 'tarefas':
        exigir_gestor_assinatura();
        // Quanto tempo cada tarefa pode ficar sem rodar antes de parecer desligada
        $tarefas = ['habitos' => 20 * 60, 'videos' => 20 * 60, 'lembretes' => 26 * 3600];
        $lista = [];
        foreach ($tarefas as $nome => $folga) {
            $em = (int) ajuste('tarefa_' . $nome . '_em', 0);
            $lista[] = ['nome' => $nome, 'minutos' => $em > 0 ? (int) floor((time() - $em) / 60) : null, 'ok' => $em > 0 && time() - $em <= $folga];
        }
        responder(200, ['tarefas' => $lista]);
        break;

    case 'testador':
        $dados = exigir_post();
        exigir_gestor_assinatura();
        $plano = assinatura_config();
        $acao = $dados['acao'] ?? '';
        if ($acao === 'incluir') {
            $email = mb_strtolower(trim(texto($dados, 'email', 190)));
            $pessoa = $email !== '' ? consultar('SELECT id, admin FROM usuarios WHERE email = ?', [$email])->fetch() : false;
            if (!$pessoa) {
                falhar(404, 'Nenhuma conta com este e-mail.');
            }
            if ((int) $pessoa['admin'] === 1) {
                falhar(422, 'A conta de gestor sempre tem acesso. Use outra conta, só para testar.');
            }
            if (count($plano['testadores']) >= 20) {
                falhar(422, 'São no máximo 20 usuários de teste.');
            }
            $id = (int) $pessoa['id'];
            $plano['testadores'] = array_values(array_filter($plano['testadores'], function ($t) use ($id) { return $t['id'] !== $id; }));
            $plano['testadores'][] = ['id' => $id, 'desde' => agora()];
        } else {
            $id = (int) ($dados['usuarioId'] ?? 0);
            $achou = false;
            foreach ($plano['testadores'] as $i => $t) {
                if ($t['id'] !== $id) {
                    continue;
                }
                $achou = true;
                if ($acao === 'tirar') {
                    unset($plano['testadores'][$i]);
                } elseif ($acao === 'recomecar') {
                    // O teste grátis começa de novo hoje
                    $plano['testadores'][$i]['desde'] = agora();
                } elseif ($acao === 'encerrar') {
                    // Para ver como fica depois do teste: o teste já acabou
                    $plano['testadores'][$i]['desde'] = date('Y-m-d H:i:s', time() - ($plano['testeDias'] + 1) * 86400);
                } else {
                    falhar(422, 'Ação desconhecida.');
                }
            }
            if (!$achou) {
                falhar(404, 'Esta conta não é usuária de teste.');
            }
        }
        salvar_plano($plano);
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
