<?php
/**
 * Copie este arquivo como config.php e preencha com os dados criados no cPanel.
 * O config.php guarda a senha do banco: nunca o compartilhe.
 */
return [
    'host'    => 'localhost',
    'banco'   => 'usuario_cpanel_nome_do_banco',
    'usuario' => 'usuario_cpanel_nome_do_usuario',
    'senha'   => 'senha_do_usuario_do_banco',
    // Qualquer frase longa e aleatória. Protege o resumo do IP.
    'segredo' => 'troque-por-uma-frase-longa-e-aleatoria',
];
