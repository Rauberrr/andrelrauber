<?php
/**
 * Copie este arquivo com o nome config.php e preencha com os seus dados.
 * O config.php guarda a senha do banco: nunca o compartilhe nem envie ao GitHub.
 */
return [
    // Dados criados no cPanel, em "Bancos de dados MySQL"
    'host'    => 'localhost',
    'banco'   => 'usuario_cpanel_nome_do_banco',
    'usuario' => 'usuario_cpanel_nome_do_usuario',
    'senha'   => 'senha_do_usuario_do_banco',

    // Uma frase longa e aleatória. Protege os registros de tentativas de acesso.
    'segredo' => 'troque-por-uma-frase-longa-e-aleatoria',

    // Endereço do site, sem barra no final. Usado nos links enviados por e-mail.
    'site_url' => 'https://andrerauber.com',

    // ID do cliente criado no Google Cloud. Vazio esconde o botão do Google.
    'google_client_id' => '',

    // E-mail que aparece como remetente. Use um e-mail do próprio domínio.
    'email_remetente' => 'nao-responda@andrerauber.com',

    // E-mail que recebe o aviso quando alguém conclui o cadastro. Vazio não avisa.
    'email_aviso' => 'andreluisrauber2006@gmail.com',
];
