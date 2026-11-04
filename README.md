# Site Andre Rauber

Site em HTML, CSS e JavaScript, com contas de clientes em PHP e MySQL.

> **Importante:** o sistema de contas precisa de PHP e MySQL, então só funciona na HostGator. No GitHub Pages, as páginas abrem, mas criar conta, entrar e preencher a tabela não funcionam.

## Colocar no ar na HostGator

### 1. Enviar os arquivos

No cPanel, abra o **Gerenciador de Arquivos**, entre em `public_html` e envie, mantendo as pastas:

- todos os arquivos `.html`
- `robots.txt`, `sitemap.xml`, `.htaccess`
- as pastas `assets` e `api`

Não envie `imagem` nem `.claude`.

Confira também se o certificado SSL está ativo para `andrerauber.com`. O `.htaccess` manda tudo para `https`, e sem certificado o navegador mostra um alerta.

### 2. Criar o banco de dados

1. No cPanel, em **Bancos de dados MySQL**, crie um banco e um usuário, e dê todos os privilégios a esse usuário no banco.
2. Abra o **phpMyAdmin**, selecione o banco, clique em **Importar** e envie o arquivo `api/banco.sql`.

### 3. Criar a configuração

1. No Gerenciador de Arquivos, copie `api/config.exemplo.php` com o nome `api/config.php`.
2. Edite o `api/config.php` e preencha os dados do banco, o `segredo` e o `email_remetente`.

O `config.php` guarda a senha do banco. Ele nunca vai para o GitHub.

### 4. Virar administrador

O painel só abre para contas marcadas como administrador. Isso nunca acontece pelo site, para ninguém conseguir se promover.

1. Crie sua conta normalmente em `criar-conta.html`.
2. No phpMyAdmin, abra a aba **SQL** e rode, com o seu e-mail:

```sql
UPDATE usuarios SET admin = 1 WHERE email = 'seu-email@exemplo.com';
```

3. Abra `painel.html`.

### 5. Ligar o login com Google (opcional)

Sem isso, o botão do Google fica escondido e o resto funciona normalmente.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie um projeto.
2. Em **APIs e serviços > Tela de consentimento OAuth**, preencha o nome do site e publique.
3. Em **Credenciais > Criar credenciais > ID do cliente OAuth**, escolha **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione `https://andrerauber.com`.
5. Copie o ID do cliente para `google_client_id` no `api/config.php`.

### 6. Conferir antes de divulgar

- [ ] Criar uma conta com e-mail e senha
- [ ] Parar no meio da tabela, sair e voltar: as respostas continuam lá
- [ ] Concluir o cadastro e ver se o aviso chegou no `email_aviso`
- [ ] Ver a pessoa e o histórico em `painel.html`
- [ ] Usar "Esqueci minha senha" e ver se o e-mail chega (confira o spam)
- [ ] Entrar com o Google
- [ ] Excluir a conta de teste em "Minha conta"

## Como acompanhar os clientes

Em `painel.html` você vê cada pessoa, a situação (não começou, parou no meio, concluiu), a etapa em que parou, quando foi a última atividade, todas as respostas e o histórico completo. O telefone abre direto no WhatsApp.

Os mesmos dados ficam no phpMyAdmin, nas tabelas `usuarios`, `cadastros` e `eventos`.

## Onde mudar cada coisa

| O que mudar | Arquivo |
| --- | --- |
| Número do WhatsApp dos links de contato | `assets/js/config.js` |
| Medidas, faixas de valores e textos do guia | `assets/js/medidas-dados.js` |
| Perguntas e ordem da tabela | `assets/js/medidas-form.js` |
| Cores e fontes | início de `assets/css/style.css` |
| Banco, Google e e-mails | `api/config.php` |
| Textos das páginas | o arquivo `.html` de cada página |

Para acrescentar uma medida nova, além de `medidas-dados.js`, crie a coluna em `cadastros` no banco e inclua o nome dela em `api/perfil.php`.
