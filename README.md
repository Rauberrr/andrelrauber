# Site Andre Rauber

Site em HTML, CSS e JavaScript, com contas de clientes em PHP e MySQL.

> **Importante:** o sistema de contas precisa de PHP e MySQL, então só funciona na HostGator. No GitHub Pages, as páginas abrem, mas criar conta, entrar e preencher a tabela não funcionam.

## Atualizar o site pelo GitHub

O site é publicado pelo **Git Version Control** do cPanel, a partir da branch `guarda-roupa`. Salvar no GitHub não muda o site sozinho.

1. Se o `api/banco.sql` mudou, importe-o no phpMyAdmin primeiro.
2. No cPanel, abra **Git Version Control**, clique em **Manage** e na aba **Pull or Deploy**.
3. Clique em **Update from Remote** e depois em **Deploy HEAD Commit**.

O `.cpanel.yml` lista o que é copiado. Ele não apaga `api/config.php` nem `api/fotos-pecas`. Nunca edite os arquivos dentro de `repositories/andrelrauber`, porque isso trava a publicação. Mudanças no `.htaccess` da raiz são feitas à mão no Gerenciador de Arquivos, e página nova precisa entrar na lista do `.cpanel.yml`.

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
- [ ] No celular, cadastrar peças em `guarda-roupa.html` e ver os looks
- [ ] Tentar abrir `api/fotos-pecas/.htaccess` no navegador: deve dar erro 403
- [ ] Excluir a conta de teste em "Minha conta"

## Guarda-roupa

Em `guarda-roupa.html`, cada cliente fotografa as próprias peças, descreve cada uma e recebe sugestões de looks.

### Atualizar um site que já está no ar

Faça nesta ordem, porque o painel depende das tabelas novas:

1. No phpMyAdmin, selecione o banco, clique em **Importar** e envie `api/banco.sql` de novo. Ele só cria o que falta e não apaga nada.
2. No Gerenciador de Arquivos, envie todos os `.html`, `sitemap.xml` e as pastas `assets` e `api`, mantendo o seu `api/config.php`.
3. Confira se `api/fotos-pecas/.htaccess` foi junto. Sem esse arquivo, o site o recria ao salvar a primeira foto.

Ao atualizar o site depois, nunca apague a pasta `api/fotos-pecas`: é nela que ficam as fotos dos clientes. Ela não vai para o GitHub, então inclua essa pasta nos seus backups.

### Como funciona

- **Fundo das fotos:** é retirado no aparelho da pessoa, com a biblioteca `@imgly/background-removal` 1.7.0, sem custo por foto. Na primeira vez, o aparelho baixa cerca de 45 MB. Se não funcionar, a pessoa pode cadastrar a foto como está.
- **Licença da biblioteca:** AGPL. Antes de usar comercialmente, confira as condições ou fale com a IMG.LY sobre uma licença comercial.
- **Fotos:** ficam em `api/fotos-pecas`, bloqueadas ao acesso direto, e só abrem para a pessoa dona delas. O servidor regrava cada imagem, o que apaga dados como a localização. Nem o painel mostra as fotos.
- **Looks:** as regras de cor, ocasião, clima e caimento estão em `assets/js/guarda-roupa-looks.js`. As listas de tipos, cores e cortes estão em `assets/js/guarda-roupa-dados.js` e `api/guarda-roupa.php`, que precisam ficar iguais.
- **Limites:** 60 peças por pessoa e 40 envios por hora, definidos em `api/guarda-roupa.php`.

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
