# Site Andre Rauber

Site em HTML, CSS e JavaScript, com contas de clientes em PHP e MySQL.

> **Importante:** o sistema de contas precisa de PHP e MySQL, então só funciona na HostGator. No GitHub Pages, as páginas abrem, mas criar conta, entrar e preencher a tabela não funcionam.

## Atualizar o site pelo GitHub

O site é publicado pelo **Git Version Control** do cPanel, a partir da branch `pagamentos`. Salvar no GitHub não muda o site sozinho.

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

1. Abra a [página de marca do Google Auth Platform](https://console.developers.google.com/auth/branding) e crie um projeto, se ele pedir.
2. Preencha o nome do aplicativo, o e-mail de suporte, o domínio autorizado `andrerauber.com`, a página inicial `https://andrerauber.com` e a política de privacidade `https://andrerauber.com/privacidade.html`. Salve.
3. Na página de público-alvo (**Audience**), publique o aplicativo, para qualquer conta Google conseguir entrar.
4. Em [Clientes](https://console.developers.google.com/auth/clients), crie um cliente do tipo **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione `https://andrerauber.com`. Não precisa de URI de redirecionamento.
6. Copie o ID do cliente, que termina em `.apps.googleusercontent.com`, para `google_client_id` no `api/config.php`. Esse ID não é secreto, mas ainda assim fica só nesse arquivo.

### 6. Conferir antes de divulgar

- [ ] Criar uma conta com e-mail e senha
- [ ] Parar no meio da tabela, sair e voltar: as respostas continuam lá
- [ ] Concluir o cadastro e ver se o aviso chegou no `email_aviso`
- [ ] Ver a pessoa e o histórico em `painel.html`
- [ ] Usar "Esqueci minha senha" e ver se o e-mail chega (confira o spam)
- [ ] Entrar com o Google
- [ ] No celular, cadastrar peças em `/apps/guarda-roupa/` e ver os looks
- [ ] Tentar abrir `api/fotos-pecas/.htaccess` no navegador: deve dar erro 403
- [ ] Excluir a conta de teste em "Minha conta"

## Apps

Os apps ficam em `/apps/`, com cara de aplicativo: barra translúcida, título grande, cartões arredondados e abas embaixo. A pessoa entra pelo link **Apps** do menu ou pelo cartão **Seus apps** em Minha conta.

**Só para quem tem conta.** Quem abre um app sem estar na conta vê uma tela de convite, com o que aquele app entrega e os botões **Criar minha conta grátis** e **Já tenho conta**. Depois de criar a conta ou entrar, a pessoa volta direto para o app. Os textos de cada tela ficam em `PORTOES`, em `assets/js/apps.js`. Quem já entrou neste aparelho vê o app na hora, enquanto a conta é confirmada; sair da conta em Minha conta desfaz isso.

| Endereço | O que é |
| --- | --- |
| `/apps/` | Início, com a saudação e um resumo de cada app para o dia |
| `/apps/guarda-roupa/` | Guarda-roupa |
| `/apps/alimentacao/` | Alimentação |
| `/apps/ocasioes/` | Ocasiões |
| `/apps/treino/` | Treino |
| `/apps/habitos/` | Hábitos |

- Os endereços antigos, `guarda-roupa.html` e `alimentacao.html`, levam para os novos.
- Cada página dos apps tem `<base href="/">`, então todos os caminhos partem da raiz do site.
- O visual dos apps fica em `assets/css/apps.css`. A barra, os ícones e as utilidades comuns ficam em `assets/js/apps.js`, e o início, em `assets/js/apps-inicio.js`.
- No celular, a pessoa pode adicionar os apps à tela inicial. Eles abrem como um aplicativo, pelo `assets/apps.webmanifest`.

### Lembretes por e-mail

A Alimentação avisa quando um item da lista de compras vai acabar, e Ocasiões avisa do prazo para encomendar e da semana do evento. Só recebe quem ligou a opção e confirmou o e-mail. Para os e-mails saírem, crie a tarefa diária no cPanel:

1. No cPanel, abra **Cron Jobs**.
2. Em **Configurações comuns**, escolha **Uma vez por dia**. Se quiser outro horário, mude a hora para 9.
3. Em **Comando**, cole:

```
/usr/local/bin/php /home2/and63667/public_html/api/tarefas/lembretes.php
```

4. Clique em **Adicionar novo trabalho Cron**.

O cPanel manda para o e-mail da conta o que a tarefa escrever, como `Lembretes enviados: 2`. Para não receber essas mensagens, apague o e-mail no campo **E-mail do Cron** no alto da página. A pasta `api/tarefas` é bloqueada ao acesso pelo navegador.

### Lembretes no navegador (Hábitos)

O app Hábitos avisa no celular ou no computador na hora de cada hábito e de cada lembrete, mesmo com o site e o navegador fechados (Web Push). Funciona no Chrome, Edge, Firefox e Safari. No iPhone, só depois de colocar o site na Tela de Início e abrir por lá; a página explica isso à pessoa.

**Sem esta tarefa do Cron, nenhum aviso sai com o site fechado.** Crie no cPanel, a cada 5 minutos (ou 15, se a hospedagem não deixar menos):

1. No cPanel, abra **Cron Jobs**.
2. Em **Configurações comuns**, escolha **A cada 5 minutos** (`*/5 * * * *`).
3. Em **Comando**, cole:

```
/usr/local/bin/php /home2/and63667/public_html/api/tarefas/habitos.php
```

4. Clique em **Adicionar novo trabalho Cron**. Para não receber um e-mail a cada vez, deixe vazio o campo **E-mail do Cron** ou ponha `>/dev/null 2>&1` no fim do comando.

Para conferir: no app Hábitos, toque em **Testar com o site fechado** e feche o site; em uns 20 segundos chega a notificação. Esse teste não depende do Cron. Os lembretes na hora marcada dependem.

Como funciona:

- O aviso vai dentro da própria notificação, cifrado de ponta a ponta (RFC 8291) com as chaves que o navegador entregou ao se inscrever (tabela `push_chaves`). O serviço de notificações (Google, Apple ou Mozilla) só transporta, sem conseguir ler. Por isso chega com o site fechado, sem depender da conta conectada no navegador. Aparelhos inscritos antes disso mandam as chaves sozinhos na próxima vez que abrirem o app; até lá, recebem o toque vazio, e o `sw.js` busca o aviso em `api/habitos.php?acao=avisos`.
- **Lembretes simples:** além dos hábitos, a pessoa cria lembretes só com o texto e a hora, para uma vez numa data, todo dia ou em alguns dias da semana (até 30). Ficam junto dos hábitos, em `apps_dados`. Vários avisos na mesma hora viram uma notificação só, com o resumo.
- Avisa na hora marcada de cada hábito que ainda não foi feito, e às 20h o resgate: o hábito ficou para trás no último dia e ainda está em aberto. A hora segue o fuso do aparelho da pessoa. Nada se repete, pela tabela `lembretes_enviados`.
- As chaves que assinam os toques (VAPID) são criadas sozinhas no primeiro uso, em `api/privado`, uma pasta bloqueada ao navegador e fora do GitHub. Não apague essa pasta: com chaves novas, todo mundo precisa ativar os lembretes de novo.
- Os aparelhos ficam em `push_inscricoes` e os avisos esperando o navegador, em `avisos_push` (apagados depois de 7 dias). Para criar essas tabelas num site que já está no ar, importe o `api/banco.sql` de novo no phpMyAdmin: ele só cria o que falta.
- Com a página aberta, o próprio app também avisa na hora, inclusive nos navegadores sem Web Push.

### Clima

O Guarda-roupa e Ocasiões mostram a previsão do tempo, por `api/clima.php`. A localização da cidade vem do OpenStreetMap e a previsão, do MET Norway. Os dois são gratuitos, permitem uso comercial e pedem poucas consultas, por isso as respostas ficam guardadas em `api/cache`: a cidade por um ano e a previsão por uma hora. Essa pasta é criada sozinha e não vai para o GitHub.

## Guarda-roupa

Em `/apps/guarda-roupa/`, cada cliente fotografa as próprias peças, descreve cada uma e recebe sugestões de looks.

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
- **Peças sugeridas:** cada pessoa recebe as peças da lista `GR_SUGERIDAS`, em `api/guarda-roupa.php`, na primeira vez que abre o guarda-roupa. As fotos sem fundo ficam em `assets/img/sugeridas`, e as originais, em `imagens-guarda-roupa`, fora do GitHub. Para acrescentar uma peça, inclua a foto e a linha na lista: quem já tem conta também a recebe.
- **Catálogo de peças:** na aba Peças, **Catálogo de peças** (ou **+ → Do catálogo**) mostra as sugeridas e as peças da marca em outras cores (`GR_CATALOGO`, em `api/guarda-roupa.php`): camisetas, camisas, moletons e calças de moletom. A pessoa toca nas que tem e elas entram no guarda-roupa, prontas para os looks; as do catálogo não contam no limite. As cores novas foram feitas recolorindo as fotos sem fundo das peças brancas e cinza, para ficarem iguais às outras.
- **Peças femininas:** no mesmo catálogo, camisetas femininas, jeans skinny, flare e wide leg, suéteres de gola V, blazer feminino e vestidos (midi de malha e chemise), em várias cores. Foram feitas a partir das fotos da marca, ajustando o caimento (cintura, perna, barra), recortando a gola V ou alongando a peça até virar vestido. Os tipos novos são **vestido**, **saia** e **blusa**, e os cortes, **skinny**, **wide leg** e **flare**. O vestido monta o look sozinho, com o calçado e, se combinar, uma camada por cima.
- **Peças cadastradas no painel:** em **Painel → Guarda-roupa**, o gestor cadastra peças para todos os clientes, com foto, tipo, cor, corte, tecido, formalidade e clima. A foto vai para uma moldura de 1000 × 1250, como as da marca (de preferência PNG sem fundo), e fica em `api/fotos-catalogo`, fora do GitHub; não apague essa pasta. Com **Colocar no guarda-roupa de todo mundo**, a peça entra sozinha para todos, como as sugeridas; sem marcar, fica só no catálogo. **Tirar do catálogo** esconde a peça, e quem já tem continua com ela. As peças ficam na tabela `catalogo_pecas`.
- **Peças excluídas:** ficam na aba Excluídas, com as fotos, até a pessoa adicionar de novo ou apagar de vez. As sugeridas só saem junto com a conta, porque a foto é da marca.
- **Várias peças de uma vez:** em **Adicionar várias**, a pessoa faz todas as fotos, descreve cada uma enquanto o fundo sai em segundo plano e guarda até 20 de cada vez. O código fica em `assets/js/guarda-roupa-lote.js`.
- **Looks:** as regras de cor, ocasião, clima e caimento estão em `assets/js/guarda-roupa-looks.js`. As listas de tipos, cores e cortes estão em `assets/js/guarda-roupa-dados.js` e `api/guarda-roupa.php`, que precisam ficar iguais.
- **Limites:** 60 peças próprias por pessoa, 120 somando as excluídas, 80 envios por hora e 300 looks com nome ou observação, definidos em `api/guarda-roupa.php`. As sugeridas não contam.
- **Nome e observação dos looks:** ficam na tabela `looks_notas`. Dar nome a uma sugestão também a guarda em Salvos.
- **Ícones nas peças:** editar, trocar a foto e excluir. Na janela da peça, dá para trocar a foto, girar e tirar o fundo de uma foto já guardada. Quem troca a foto de uma peça sugerida passa a ter a peça como sua, e ela conta no limite.
- **Diário:** a pessoa anota o que usou, em que dia e onde, pelo botão **Usei hoje** nos looks ou pelo **+**. Fica na tabela `usos_pecas`, com até 3.000 anotações por pessoa. Ao anotar, o app avisa se um look parecido já foi usado no mesmo lugar nos últimos 60 dias.
- **Peças paradas:** as peças próprias que passam 6 meses sem aparecer no diário, com um convite para um ajuste sob medida.
- **Custo por uso:** a pessoa informa quanto pagou na peça, guardado em `pecas_valores`, e o app divide pelas vezes que ela usou.
- **Clima do dia:** a aba Looks já abre com o clima de hoje na cidade da pessoa, ou de amanhã, depois das 19h.

## Coleção

A coleção fica em `colecao.html`. Cada peça tem a sua página, em `produto.html?p=nome-da-peca`. Enquanto não houver peças no ar, a coleção avisa que novos produtos chegam em breve, e `produto.html?exemplo=1` mostra como a página de uma peça vai ficar.

### Cadastrar uma peça

1. Entre no site com a conta de gestor e abra **Painel**, em Minha conta.
2. Na aba **Coleção**, toque em **Nova peça**.
3. Preencha nome, categoria, preço, frete (em branco é frete grátis), prazo de confecção, modelagem, tecido, composição, gramatura, cuidados, detalhes (um por linha) e as cores.
4. Toque em **Salvar**. Depois disso, envie as fotos: a primeira é a capa, e as setas mudam a ordem.
5. Para a peça aparecer no site, mude a **Situação** para **No ar**. **Esgotado** mostra a peça sem o botão de compra. **Ver a página** abre a prévia, mesmo antes de ir ao ar.

As fotos ficam em `api/fotos-produtos`, fora do GitHub, e saem por `api/produtos.php`. Como a pasta de fotos das peças, ela não deve ser apagada ao atualizar o site.

### Lançar uma coleção numa data

Em **Agendar coleção**, dê um nome, a data e a hora do lançamento (horário de Brasília) e uma chamada. Escolha essa coleção nas peças. Até a data, a página da coleção mostra a contagem regressiva, e as peças ficam escondidas; na hora marcada, todas aparecem juntas.

### Comprar uma peça

Na página da peça, a pessoa escolhe a cor e toca em **Comprar** (abre a sacola) ou **Adicionar à sacola** (continua olhando). O botão de compartilhar, ao lado do nome, usa o compartilhamento do celular ou oferece WhatsApp e copiar o link.

- **Sacola:** o ícone no topo da coleção e das peças mostra quantas peças há. A sacola fica no aparelho (`assets/js/sacola.js`), com até 10 peças diferentes e 5 unidades de cada, e atualiza preço e disponibilidade pela vitrine ao abrir.
- **Finalizar compra:** pede o aceite das condições de compra e cria **um pedido só** com todas as peças (`api/pedidos.php?acao=finalizar`): soma as peças e cobra o maior frete, porque vão juntas. As peças do pedido ficam na tabela `pedidos_itens`. Com o Mercado Pago ligado, a pessoa já vai direto para o pagamento; sem ele, o pedido aparece em Minha conta.
- Sem conta, a pessoa entra antes. Sem as medidas preenchidas, a sacola pede para preencher, porque cada peça é feita a partir delas.

### Pedido exclusivo

Em `pedido-exclusivo.html`, a pessoa descreve a peça em sete passos: a peça, a ocasião, o tecido, a cor, o caimento com os detalhes de cada peça, uma referência e o prazo, e a revisão. Os tecidos são os tradicionais; couro, camurça, veludo, seda pura, paetê e tecidos técnicos ficam de fora, como diz o próprio formulário. As opções ficam em `assets/js/colecao-dados.js`.

Os pedidos chegam na aba **Pedidos exclusivos** do painel, com um aviso no e-mail de `email_aviso`. Ali você muda a situação, responde pelo WhatsApp e abre a ficha do cliente para criar o pedido de pagamento quando fechar o valor.

## Pedidos e pagamento

O cliente paga o valor total pelo Mercado Pago, com Pix ou cartão, em Minha conta. Você cria cada pedido no painel, na ficha da pessoa, com a descrição, o valor e o frete.

### Ligar o pagamento

1. No Mercado Pago, cadastre uma chave Pix na conta e ative as credenciais de produção da aplicação.
2. Em **Suas integrações > Webhooks > Configurar notificações**, preencha `https://andrerauber.com/api/pagamento-aviso.php` em produção, marque o evento **Pagamentos** e salve. Revele a assinatura secreta gerada.
3. No Gerenciador de Arquivos, edite `api/config.php` diretamente, sem criar cópias dele dentro de `public_html`, e acrescente, antes do `];` do final:

```php
'mercadopago_token' => 'cole-aqui-o-access-token-de-producao',
'mercadopago_assinatura' => 'cole-aqui-a-assinatura-secreta',
'mercadopago_parcelas' => 0,
```

4. Crie um pedido de R$ 1,00 para a sua própria conta, pague pelo site e confira se ele muda para **Pago**. Depois, estorne pelo Mercado Pago.

Nunca envie esses valores por mensagem nem os coloque no GitHub.

### Como funciona

- **Confirmação:** o site só marca um pedido como pago depois de consultar o pagamento no Mercado Pago e conferir o valor. Se o aviso falhar, o pedido é conferido quando o cliente volta ao site, e o painel tem o botão **Conferir no Mercado Pago**.
- **Parcelas:** com `mercadopago_parcelas` em 0, valem as opções do Mercado Pago. Com outro número, de 1 a 36, esse é o máximo oferecido.
- **Boleto:** fica fora das opções, para a confecção não depender de um pagamento que demora a compensar.
- **Estorno:** é feito pelo Mercado Pago. O pedido muda para **Pagamento devolvido** quando o aviso chega.
- **Exclusão de conta:** quem tem pedido pago, em análise ou em disputa, com movimento nos últimos 90 dias, precisa falar com você para excluir a conta.
- **Condições:** o texto fica em `condicoes-de-compra.html`. Peça a um advogado para revisar antes de vender.

## Publicar vídeos (painel)

Em **Painel → Vídeos** (`painel-videos.html`, só para administrador), você sobe um vídeo, escreve uma descrição para todas as redes, marca onde publicar e clica em **Publicar** ou **Agendar**. O painel publica no Instagram (Reels), no Facebook (Reels da Página), no YouTube (Shorts) e no TikTok.

- O vídeo sobe em pedaços de 4 MB assim que é escolhido, então funciona com vídeos grandes (até 500 MB) e conexão instável. Use MP4 ou MOV vertical (9:16). Para virar Short no YouTube, até 3 minutos.
- O que é "agora" o próprio painel publica enquanto a página está aberta. O agendado sai pela tarefa do Cron, com até 5 minutos de diferença. Se fechar a página no meio, o Cron termina.
- Cada rede aparece separada na lista, com o link do post, o erro que a rede deu (com **Tentar de novo**) e **Cancelar** para o que ainda está agendado.
- O Instagram baixa o vídeo direto do site, por um link temporário e assinado (`api/video.php`, válido por 6 horas). Os outros recebem o arquivo enviado pelo servidor.
- Os vídeos ficam em `api/privado/videos` e saem do servidor 3 dias depois de publicados em todas as redes. As contas ficam na tabela `redes_contas`, com os tokens cifrados pelo `segredo` do `config.php`. As senhas das redes nunca passam pelo site: você entra na página da própria rede.

### O que cada rede permite hoje

| Rede | Funciona | Antes de ficar público |
| --- | --- | --- |
| Instagram | Na hora, com o app da Meta em modo de desenvolvimento (vale para você, que é o dono do app). Conta Profissional ligada a uma Página do Facebook. | Nada. Limite da Meta: cerca de 50 a 100 publicações por dia. |
| Facebook | Na hora, nas mesmas condições. | Nada. Limite: 30 Reels por dia. |
| YouTube | Na hora, mas o vídeo sai **privado**. | Pedir a auditoria do Google (gratuita, algumas semanas). Depois disso sai como `youtube_privacidade`. A cota gratuita dá uns 6 vídeos por dia. |
| TikTok | Depois de o TikTok aprovar o app; até lá, só em modo de teste e **privado**. | Pedir a análise do app (algumas semanas). Depois, mude `tiktok_privacidade` para `PUBLIC_TO_EVERYONE`. |

### Ligar as redes

Em todos os apps, o endereço de retorno (redirect URI) é o mesmo: `https://andrerauber.com/api/conectar.php`. As chaves vão só no `config.php` do servidor (veja `config.exemplo.php`); nunca no GitHub nem em mensagens.

**Instagram e Facebook (um app da Meta para os dois)**

1. Confira que o Instagram da marca é conta **Profissional** e está ligado à Página do Facebook (no Instagram: Configurações → Central de Contas, ou na Página: Configurações → Contas vinculadas).
2. Em developers.facebook.com, **Meus apps → Criar app**, do tipo **Empresa**.
3. Adicione os produtos **Login do Facebook para Empresas** e **Instagram** (na opção de configurar a API com o login do Facebook).
4. Em Login do Facebook → Configurações, ponha o endereço de retorno em **URIs de redirecionamento do OAuth válidos**.
5. Em **Configurações do app → Básico**, copie o ID do app e a Chave secreta para `meta_app_id` e `meta_app_secret`.
   Em Login do Facebook para Empresas → Configurações, crie uma configuração (token de usuário; ativos Páginas e Contas do Instagram; as permissões `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`) e ponha o ID dela em `meta_config_id`.
6. No painel, em Vídeos, clique em **Conectar** no cartão Instagram e Facebook e autorize as permissões e a Página.

O app pode ficar em modo de desenvolvimento: ele funciona para quem é administrador do app. Só é preciso pedir a análise da Meta se um dia outras pessoas forem usar.

**YouTube (um projeto no Google Cloud)**

1. Em console.cloud.google.com, crie um projeto e ative a **YouTube Data API v3** (APIs e serviços → Biblioteca).
2. Em **Tela de consentimento OAuth**, escolha Externo, preencha o nome e o e-mail e depois clique em **Publicar app**. Em modo de teste, o Google desconecta a cada 7 dias. Ao conectar, vai aparecer "app não verificado": clique em Avançado e continue, porque o app é seu.
3. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**, com o endereço de retorno. Copie o ID e a chave secreta para `youtube_client_id` e `youtube_client_secret`.
4. Para os vídeos saírem públicos, preencha o formulário **YouTube API Services – Audit and Quota Extension**, explicando que é para publicar os vídeos da própria marca.

**TikTok**

1. Em developers.tiktok.com, **Manage apps → Connect an app**, com o site e os links da política de privacidade e dos termos.
2. Adicione os produtos **Login Kit** (com o endereço de retorno) e **Content Posting API**, com **Direct Post** ligado. Os escopos são `user.info.basic` e `video.publish`.
3. Copie o Client key e o Client secret para `tiktok_client_key` e `tiktok_client_secret`.
4. Envie o app para análise. Até a aprovação, adicione a sua conta como usuária de teste (Sandbox) para testar; os vídeos saem privados. Aprovado, mude `tiktok_privacidade` para `PUBLIC_TO_EVERYONE`.

### Tarefa do Cron

Importe o `api/banco.sql` de novo (cria `redes_contas`, `videos` e `publicacoes`) e crie no cPanel, em **Cron Jobs**, uma tarefa **a cada 5 minutos** (ou 15, se a hospedagem não deixar menos):

```
/usr/local/bin/php /home2/and63667/public_html/api/tarefas/videos.php >/dev/null 2>&1
```

## Ocasiões

Em `/apps/ocasioes/`, a pessoa anota um evento, como casamento, formatura, entrevista ou viagem, e recebe:

- o traje explicado, com o que usar e o que evitar. Se o convite não diz o traje, o app sugere o mais comum para o tipo de evento e o horário;
- o look montado com as peças do Guarda-roupa. O look escolhido também fica salvo no Guarda-roupa, com o nome do evento;
- o que falta e até quando encomendar a peça sob medida, com o botão para pedir pelo WhatsApp. Padrinhos e noivos recebem essa sugestão mesmo com o look pronto;
- nas viagens, a mala com poucas peças que combinam entre si e uma lista do que não esquecer.

A pessoa pode mudar tudo o que o app sugere:

- **Look:** depois de escolher, **Editar peças** tira peças e inclui outras do Guarda-roupa, até 8. **Montar o meu look** começa do zero.
- **Mala:** tirar peças sugeridas, incluir outras do Guarda-roupa e incluir itens em texto. **Voltar à sugestão** desfaz.
- **Não esqueça:** editar o texto de cada item no lápis, tirar itens e incluir novos. As caixas de marcar continuam.

Os prazos de confecção são estimativas, em `SOB_MEDIDA` e `FOLGA`, no começo de `assets/js/ocasioes-dados.js`. Mude os dias para os seus prazos reais. Os eventos ficam no navegador e, para quem tem conta, na tabela `apps_dados`.

## Treino

Em `/apps/treino/`, a pessoa escolhe o objetivo, a experiência, o local (academia, casa com halteres ou casa sem equipamento), os dias por semana e o tempo, e marca se sente dor no joelho, no ombro ou na lombar. O app monta a divisão (corpo inteiro, parte de cima e pernas, ou empurrar, puxar e pernas), guia o treino com as séries e o descanso, guarda as cargas e mostra a semana. Os exercícios e as alternativas ficam em `assets/js/treino-dados.js`.

- **Foco:** a pessoa pode escolher até dois grupos, como peito e braços. Os treinos que trabalham esses grupos ganham até dois exercícios a mais, e cada exercício do foco ganha uma série a mais. Eles aparecem com o selo **Foco**.
- **Um plano padrão e as fases:** a pessoa vê um plano só. Quando o treino cansa, fica repetitivo ou para de render, ela toca no que está sentindo em **O treino não está mais rendendo?** e começa a fase seguinte (periodização): **Base** (repetições do objetivo), **Força** (menos repetições, mais carga e descanso) e **Volume** (mais repetições, descanso curto), em ciclo. Cada fase troca os exercícios por outros para os mesmos músculos e muda a faixa de repetições e o descanso (`FASES` e `ESQUEMAS`, em `treino-dados.js`). A barra da fase sugere mudar depois de 6 semanas. Também dá para **Refazer as perguntas**. Nada disso mexe no histórico nem na evolução das cargas; cada treino registrado guarda a fase em que foi feito.
- **Trocar um exercício:** o botão de troca mostra até 3 exercícios do mesmo grupo muscular que servem para o local e os cuidados da pessoa. Com restrições fortes, como em casa e com dor no joelho, podem sobrar menos de 3. A troca vale para aquele treino e aquela fase.
- **Ligação com a Alimentação:** os dois apps usam as mesmas medidas (sexo, idade, altura e peso), guardadas no navegador em `ar-corpo-v1`. Quem preenche num, não digita de novo no outro. Ao terminar o plano alimentar, a Alimentação convida a montar o treino; depois de montar o treino, o Treino mostra a meta de calorias e de proteína do plano, ou convida a montá-lo. Os dias de treino sugerem a rotina na Alimentação, e o objetivo passa de um app para o outro.

- **Carga e repetições por série:** durante o treino, cada série tem os campos de carga (kg) e repetições (ou segundos, nos exercícios de tempo). O que foi feito da última vez aparece como sugestão e vale se a pessoa marcar a série sem preencher.
- **Sua evolução:** para cada exercício, a melhor série de cada treino num gráfico, com o começo, o atual e o recorde. A melhor série é a de maior força estimada (fórmula de Epley: carga × (1 + repetições ÷ 30)), que junta carga e repetições numa conta só.
- **Procurar ou criar exercício:** a pessoa procura pelo nome em todo o catálogo e vê onde o exercício encaixa no plano dela: no lugar de outro do mesmo músculo, em cada treino e opção. Se ele não existir, ela cria o seu (até 30). O músculo é adivinhado pelo nome, por palavras como rosca, supino, remada ou agachamento (`PALAVRAS`, em `treino-dados.js`), e ela pode trocar. Os exercícios criados entram nas trocas como os outros. Para incluir mais exercícios para todo mundo, basta acrescentar em `EXERCICIOS` e no movimento certo de `MOVIMENTOS`.

O treino fica no navegador e só vai para a conta, na tabela `apps_dados`, se a pessoa autorizar. A página avisa que é uma sugestão geral e recomenda um médico e um profissional de educação física.

## Hábitos

Em `/apps/habitos/`, para quem já tentou mudar um hábito e desistiu. O app segue três regras: começar ridiculamente pequeno (cada hábito tem a sua **versão de 2 minutos**, que também conta), prender o hábito novo a algo que a pessoa já faz (**Logo depois de…**) e **nunca falhar duas vezes**: se o hábito ficou para trás no último dia marcado, o cartão fica em destaque e o lembrete das 20h chama a pessoa.

- Cada hábito tem a identidade que a pessoa quer construir (“quero ser alguém que lê todos os dias”). Ao cumprir, o app comemora com um voto para essa identidade e marca as sequências de 3, 7, 14, 21, 30, 66 e 100 dias.
- Hoje: um anel com quanto do dia já foi feito, e para cada hábito os botões **Fiz**, **Só o mínimo** e **Hoje não**, a sequência e os últimos 7 dias.
- Sua consistência: o mapa das últimas 12 semanas e, para cada hábito, a sequência, o recorde e quanto foi cumprido nos últimos 30 dias.
- Modelos prontos (ler, beber água, treinar, caminhar, meditar...) em `MODELOS`, no `assets/js/habitos.js`. Quem tenta criar mais de 3 hábitos recebe a dica de firmar os que já tem.

Os hábitos ficam no navegador e só vão para a conta se a pessoa autorizar. Os lembretes com o navegador fechado precisam deles na conta, e a página pede essa autorização ao ativar.

## Tarefas automáticas (Cron)

São três. Cadastre cada uma em **Cron Jobs**, no cPanel; o topo do **Painel** mostra quando cada uma rodou pela última vez.

| Tarefa | Quando | Comando |
| --- | --- | --- |
| Lembretes e hábitos (notificações) | A cada 5 minutos (`*/5 * * * *`) | `/usr/local/bin/php /home2/and63667/public_html/api/tarefas/habitos.php >/dev/null 2>&1` |
| Vídeos agendados | A cada 5 minutos (`*/5 * * * *`) | `/usr/local/bin/php /home2/and63667/public_html/api/tarefas/videos.php >/dev/null 2>&1` |
| E-mails de lembrete (Alimentação e Ocasiões) | Uma vez por dia, às 9h (`0 9 * * *`) | `/usr/local/bin/php /home2/and63667/public_html/api/tarefas/lembretes.php >/dev/null 2>&1` |

## Assinatura dos apps

Em **Painel → Assinatura**, o gestor escolhe em que modo os apps estão:

| Modo | Os apps | A página `assinatura.html` |
| --- | --- | --- |
| Grátis, página oculta (padrão) | Grátis para quem tem conta | Só o gestor vê, como prévia |
| Grátis, com aviso de teste | Grátis para quem tem conta | Todos veem: os apps estão em teste e vai ter assinatura mensal. A tela inicial dos apps mostra o aviso |
| Cobrando | Cada pessoa usa grátis pelos dias de teste; depois, só quem assina ou tem acesso liberado | Quem não tem é levado para a página do plano |

- **Teste grátis:** em **Dias de teste grátis** (7 por padrão, 0 desliga). Com a cobrança ligada, os dias contam da criação da conta ou do dia em que a cobrança começou, o que for mais recente. A tela inicial dos apps mostra quantos dias faltam.
- **Quem já usa continua grátis:** marcado por padrão. Ao ligar a cobrança, as contas criadas antes disso seguem usando sem pagar; só as contas novas passam pelo teste e pela assinatura. Desmarcado, todo mundo ganha os dias de teste a partir do dia em que a cobrança foi ligada.
- **Usuários de teste:** em **Usuários de teste**, o gestor coloca o e-mail de uma conta (não a de gestor) que passa a ver a cobrança como se ela estivesse ligada, mesmo com os apps grátis para todos. Dá para **Recomeçar o teste** (os dias voltam a contar de hoje), **Ver depois do teste** (a conta já cai na página do plano) e **Tirar** da lista. Até 20 contas.
- **A página:** clara e minimalista, com os benefícios primeiro, o "como funciona" (teste grátis, assinar, cancelar quando quiser) e o valor discreto, no fim.

- No mesmo lugar ficam o nome do plano, o valor por mês e o que ele inclui. O gestor sempre usa os apps.
- **Acesso liberado:** o gestor libera uma conta pelo e-mail, com ou sem data para acabar (cortesia, parceria, quem pagou por fora). Fica na tabela `assinaturas`.
- **Pagamento online (Mercado Pago):** com o `mercadopago_token` no `config.php`, o botão **Assinar** cria uma assinatura mensal no Mercado Pago e leva a pessoa para a tela de lá, onde ela cadastra o cartão. A cobrança é automática todo mês, no cartão de crédito (assinaturas do Mercado Pago não aceitam Pix). Quem assina durante o teste grátis só é cobrado quando o teste acaba.
- **Como o acesso muda:** o site nunca confia só no aviso: a cada aviso do Mercado Pago (`api/pagamento-aviso.php`, eventos de assinatura), na volta da pessoa e uma vez por dia (tarefa dos e-mails), ele consulta a assinatura no Mercado Pago. Autorizada: acesso até a próxima cobrança, mais 3 dias de folga. Cancelada ou pausada: o acesso vai até o fim do mês pago e acaba. Fica nas tabelas `assinaturas` e `assinaturas_mp`.
- **Cancelar:** a pessoa cancela na própria página do plano ou no app do Mercado Pago.
- Sem o token, quem toca em Assinar recebe o link do WhatsApp da marca, e o gestor libera o acesso pelo e-mail.

### Ligar a assinatura no Mercado Pago

1. Use as mesmas credenciais de produção dos pedidos (`mercadopago_token` e `mercadopago_assinatura` no `config.php`). Não precisa de chave nova.
2. No painel do Mercado Pago, em **Suas integrações → (sua aplicação) → Webhooks**, no endereço `https://andrerauber.com/api/pagamento-aviso.php`, marque também os eventos **Planos e assinaturas** (assinaturas e pagamentos de assinatura), além de **Pagamentos**, e salve.
3. Importe o `api/banco.sql` de novo (cria `assinaturas_mp`).
4. Teste com um usuário de teste: em **Painel → Assinatura → Usuários de teste**, inclua uma conta sua (não a de gestor), entre com ela, abra a página do plano e toque em **Assinar agora**. No Mercado Pago, entre com uma conta **diferente** da conta que recebe os pagamentos (o Mercado Pago não deixa a pessoa assinar o próprio plano) e use o mesmo e-mail da conta de teste do site. Depois, cancele pela página.
5. Quando estiver tudo certo, mude o modo para **Grátis, com aviso do valor** por uns dias e depois para **Cobrando**.
- Com a cobrança ativa, as APIs dos apps respondem 402 para quem não tem acesso, e os lembretes dessas pessoas param. Os dados continuam guardados.
- O modo e os ajustes ficam na tabela `configuracoes`. Para criar as tabelas novas num site que já está no ar, importe o `api/banco.sql` de novo.

## Alimentação

Os alimentos ficam em `assets/js/alimentacao-dados.js` (`PRODUTOS`, com embalagem e preço, e `ALIMENTOS`, com os valores por 100 g). Além do básico, há mel, aveia, granola, morango, uva, abacaxi e o grupo **Suplementos**: whey protein, hipercalórico, creatina e barra de proteína, com preço de prateleira de marcas populares. Os suplementos não mudam de quantidade quando o plano se ajusta à meta.

Em `/apps/alimentacao/`, a pessoa informa sexo, idade, altura, peso, rotina, objetivo e estado, marca o que come num dia comum e recebe:

- o gasto calórico, pela fórmula de Mifflin-St Jeor, e uma meta com déficit ou superávit moderado;
- um plano, com trocas saudáveis no que ela já come ou montado do zero;
- a lista de compras, com quanto dura cada embalagem, de quanto em quanto tempo comprar e o custo por mês, comparando o plano com o que ela come hoje.
- **5 opções completas para cada refeição** (café, almoço, lanche e jantar), em `OPCOES`, no `assets/js/alimentacao-calculo.js`. A porção acompanha a energia da refeição no plano, e cada alimento ainda pode ser trocado.
- **Hoje:** a pessoa registra o que comeu (a refeição do plano com um toque, ou outro alimento) e vê na hora quanto ainda cabe, a proteína e o que pode ou é melhor evitar.
- **Dia com e sem treino:** o gasto do dia já conta os treinos da semana como uma média. Por isso a meta é dividida: nos dias de treino ela sobe o que o treino gasta (cerca de 5 vezes o gasto em repouso pelo tempo do treino), e nos outros fica um pouco menor, para a semana fechar igual. O dia de treino vem do app Treino ou da chave **Treinei hoje**.

Os dados ficam no navegador da pessoa. Quem tem conta pode autorizar que também fiquem na conta, na tabela `alimentacao`, para abrir em qualquer aparelho. Como são dados de saúde, o servidor só guarda com essa autorização, aceita apenas os campos que a página usa e não mostra nada disso no painel, só o fato de a pessoa ter autorizado. Depois de terminar as perguntas, a pessoa cai num resumo, de onde altera qualquer parte. Os valores nutricionais são aproximados da Tabela Brasileira de Composição de Alimentos (TACO).

### Atualizar os preços

Os preços ficam em `assets/js/alimentacao-dados.js`.

1. **Cesta básica (13 itens):** em [dieese.org.br/cesta](https://www.dieese.org.br/cesta), aba **Banco de Dados**, escolha a consulta por data, o mês mais recente, **Preço médio** e todos os produtos e cidades. Copie os valores para a tabela `DIEESE` e atualize `DIEESE_DATA`.
2. **Demais produtos:** cada um tem um preço `base`, que é um preço comum de prateleira, sem promoção. Revise esses valores a cada poucos meses. A página ajusta esses preços pela região, comparando os preços do DIEESE de cada capital com a média.
3. **Salário mínimo:** atualize `SALARIO_MINIMO` todo começo de ano.

Entre uma atualização e outra, os preços são corrigidos sozinhos pela inflação dos alimentos. Todo mês, `api/precos.php` consulta no IBGE o IPCA da alimentação no domicílio e multiplica os preços pela variação desde o mês dos preços. Ao trocar os preços do DIEESE, mude também `PRECOS_BASE`, no começo de `api/precos.php`, para o mesmo mês, no formato `202609`.

## Continuar conectado

A hospedagem apaga as sessões paradas depois de alguns minutos. Para a pessoa não precisar entrar toda vez, cada login cria um token de "manter conectado", guardado no cookie `ar_lembrar` por 90 dias e renovado a cada dia de uso. O banco guarda só o resumo (hash) do segredo, na tabela `sessoes_lembradas`, um por aparelho. Sair apaga o token daquele aparelho, e trocar a senha desconecta todos.

## E-mail das contas

Ao criar uma conta, o site recusa formato errado, erro comum de digitação, como `gmail.con`, e domínio que não existe. Depois, envia um link de confirmação, válido por 7 dias. Só esse link prova que a caixa de e-mail é real.

A pessoa pode usar a conta antes de confirmar, porque o e-mail às vezes cai no spam. Minha conta mostra um aviso com a opção de reenviar, e a ficha de cada cliente no painel mostra se o e-mail foi confirmado. Quem entra com o Google já chega confirmado.

## Como acompanhar os clientes

Em `painel.html` você vê cada pessoa, a situação (não começou, parou no meio, concluiu), a etapa em que parou, quando foi a última atividade, todas as respostas e o histórico completo. O telefone abre direto no WhatsApp.

Os mesmos dados ficam no phpMyAdmin, nas tabelas `usuarios`, `cadastros` e `eventos`.

## Onde mudar cada coisa

| O que mudar | Arquivo |
| --- | --- |
| Número do WhatsApp dos links de contato | `assets/js/config.js` |
| Prazos de confecção usados em Ocasiões | `assets/js/ocasioes-dados.js` |
| Exercícios do Treino | `assets/js/treino-dados.js` |
| Modelos de hábitos | `assets/js/habitos.js` |
| Publicar vídeos (redes, envio, etapas) | `api/redes.php`, `api/videos.php`, `assets/js/painel-videos.js` |
| Catálogo do guarda-roupa (peças e cores) | `GR_CATALOGO` em `api/guarda-roupa.php`, `assets/js/guarda-roupa-catalogo.js`, `assets/js/painel-extras.js` |
| Assinatura (modos, plano, acesso) | `api/assinatura.php`, `ASSINATURA_PADRAO` em `api/nucleo.php`, `assinatura.html`, `assets/js/assinatura.js` |
| Fases do treino | `FASES`, `ESQUEMAS` e `MOTIVOS` em `assets/js/treino-dados.js` |
| Lembretes e notificações | `assets/js/habitos.js`, `api/push.php`, `api/tarefas/habitos.php`, `sw.js` |
| Visual dos apps | `assets/css/apps.css` |
| Opções do pedido exclusivo e categorias da coleção | `assets/js/colecao-dados.js` |
| Fita métrica da página inicial | `assets/js/home-animacoes.js` |
| Textos de convite dos apps para quem não tem conta | `PORTOES`, em `assets/js/apps.js` |
| Medidas, faixas de valores e textos do guia | `assets/js/medidas-dados.js` |
| Perguntas e ordem da tabela | `assets/js/medidas-form.js` |
| Cores e fontes | início de `assets/css/style.css` |
| Banco, Google e e-mails | `api/config.php` |
| Textos das páginas | o arquivo `.html` de cada página |

Para acrescentar uma medida nova, além de `medidas-dados.js`, crie a coluna em `cadastros` no banco e inclua o nome dela em `api/perfil.php`.
