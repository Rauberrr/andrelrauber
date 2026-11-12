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

    // Mercado Pago: Access Token de "Credenciais" e a assinatura secreta de "Webhooks".
    // Vazio deixa o pagamento pelo site desligado. Nunca compartilhe esses valores.
    'mercadopago_token' => '',
    'mercadopago_assinatura' => '',

    // Máximo de parcelas oferecidas. Com 0, valem as opções do próprio Mercado Pago.
    'mercadopago_parcelas' => 0,

    // Publicar vídeos (painel do gestor). Cada rede tem um app de desenvolvedor criado por você;
    // o passo a passo está no README. Vazio deixa a rede desligada. Nunca compartilhe esses valores.
    // Endereço de retorno para cadastrar em todos os apps: https://andrerauber.com/api/conectar.php
    'meta_app_id' => '',
    'meta_app_secret' => '',
    // ID da configuração do Login do Facebook para Empresas (só números). Vazio pede as permissões direto.
    'meta_config_id' => '',
    'youtube_client_id' => '',
    'youtube_client_secret' => '',
    'tiktok_client_key' => '',
    'tiktok_client_secret' => '',
    // Até o TikTok aprovar o app, só SELF_ONLY (privado). Depois: PUBLIC_TO_EVERYONE.
    'tiktok_privacidade' => 'SELF_ONLY',
    // public, unlisted ou private. Até o YouTube aprovar o app, os vídeos ficam privados mesmo assim.
    'youtube_privacidade' => 'public',
];
