# Site Andre Rauber

Site estático em HTML, CSS e JavaScript, pronto para a HostGator.

## Publicar

1. No cPanel, abra o **Gerenciador de Arquivos** e entre em `public_html`.
2. Envie estes itens, mantendo as pastas:
   - `index.html`, `a-marca.html`, `medidas.html`, `guia-de-medidas.html`, `contato.html`, `privacidade.html`, `404.html`
   - `robots.txt`, `sitemap.xml`, `.htaccess`
   - as pastas `assets` e `api`
3. Não envie `imagem` nem `.claude`. A logo já está em `assets/img`.
4. No cPanel, confira se o certificado SSL está ativo para `andrerauber.com`. O `.htaccess` redireciona tudo para `https`, então sem certificado o navegador mostra um alerta.
5. Abra `https://andrerauber.com/medidas.html`, preencha um teste e confira a mensagem no WhatsApp.

## Onde mudar cada coisa

| O que mudar | Arquivo |
| --- | --- |
| Número do WhatsApp | `assets/js/config.js` |
| Medidas, faixas de valores e textos do guia | `assets/js/medidas-dados.js` |
| Cores e fontes | início de `assets/css/style.css` |
| Textos das páginas | o arquivo `.html` de cada página |

## Ligar o banco de dados (quando quiser)

Hoje o site só envia pelo WhatsApp e não guarda nada. Para também guardar as medidas:

1. No cPanel, em **Bancos de dados MySQL**, crie um banco e um usuário e dê todos os privilégios a esse usuário no banco.
2. Abra o **phpMyAdmin**, selecione o banco, clique em **Importar** e envie o arquivo `api/banco.sql`.
3. Faça uma cópia de `api/config.exemplo.php` com o nome `api/config.php` e preencha os dados do passo 1.
4. Em `assets/js/config.js`, troque `salvarNoBanco: false` por `salvarNoBanco: true`.
5. Atualize `privacidade.html`, na parte "Onde ficam", informando que os dados passam a ser guardados e por quanto tempo.
6. Envie um teste e confira no phpMyAdmin se a linha apareceu na tabela `medidas_clientes`.

Se o banco falhar, o cliente continua conseguindo enviar pelo WhatsApp.

> O código PHP ainda não foi executado, porque este computador não tem PHP. Faça o teste do passo 6 antes de confiar no salvamento.
