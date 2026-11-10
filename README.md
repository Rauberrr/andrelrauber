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

Na página da peça, a pessoa escolhe a cor e toca em **Encomendar sob medida**. Sem conta, entra antes. Sem as medidas preenchidas, o site pede para preencher. Com tudo certo, o pedido é criado com o preço e o frete da peça e aparece em Minha conta, pronto para pagar pelo Mercado Pago, como os pedidos criados no painel.

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
- **3 opções por treino:** cada treino (A, B, C...) tem 3 opções, com exercícios diferentes para os mesmos músculos. A pessoa escolhe a opção no cartão do treino, ou liga **Alternar as opções a cada treino**.
- **Trocar um exercício:** o botão de troca mostra até 3 exercícios do mesmo grupo muscular que servem para o local e os cuidados da pessoa. Com restrições fortes, como em casa e com dor no joelho, podem sobrar menos de 3. A troca vale para aquele treino e aquela opção.
- **Ligação com a Alimentação:** os dois apps usam as mesmas medidas (sexo, idade, altura e peso), guardadas no navegador em `ar-corpo-v1`. Quem preenche num, não digita de novo no outro. Ao terminar o plano alimentar, a Alimentação convida a montar o treino; depois de montar o treino, o Treino mostra a meta de calorias e de proteína do plano, ou convida a montá-lo. Os dias de treino sugerem a rotina na Alimentação, e o objetivo passa de um app para o outro.

O treino fica no navegador e só vai para a conta, na tabela `apps_dados`, se a pessoa autorizar. A página avisa que é uma sugestão geral e recomenda um médico e um profissional de educação física.

## Alimentação

Em `/apps/alimentacao/`, a pessoa informa sexo, idade, altura, peso, rotina, objetivo e estado, marca o que come num dia comum e recebe:

- o gasto calórico, pela fórmula de Mifflin-St Jeor, e uma meta com déficit ou superávit moderado;
- um plano, com trocas saudáveis no que ela já come ou montado do zero;
- a lista de compras, com quanto dura cada embalagem, de quanto em quanto tempo comprar e o custo por mês, comparando o plano com o que ela come hoje.

Os dados ficam no navegador da pessoa. Quem tem conta pode autorizar que também fiquem na conta, na tabela `alimentacao`, para abrir em qualquer aparelho. Como são dados de saúde, o servidor só guarda com essa autorização, aceita apenas os campos que a página usa e não mostra nada disso no painel, só o fato de a pessoa ter autorizado. Depois de terminar as perguntas, a pessoa cai num resumo, de onde altera qualquer parte. Os valores nutricionais são aproximados da Tabela Brasileira de Composição de Alimentos (TACO).

### Atualizar os preços

Os preços ficam em `assets/js/alimentacao-dados.js`.

1. **Cesta básica (13 itens):** em [dieese.org.br/cesta](https://www.dieese.org.br/cesta), aba **Banco de Dados**, escolha a consulta por data, o mês mais recente, **Preço médio** e todos os produtos e cidades. Copie os valores para a tabela `DIEESE` e atualize `DIEESE_DATA`.
2. **Demais produtos:** cada um tem um preço `base`, que é um preço comum de prateleira, sem promoção. Revise esses valores a cada poucos meses. A página ajusta esses preços pela região, comparando os preços do DIEESE de cada capital com a média.
3. **Salário mínimo:** atualize `SALARIO_MINIMO` todo começo de ano.

Entre uma atualização e outra, os preços são corrigidos sozinhos pela inflação dos alimentos. Todo mês, `api/precos.php` consulta no IBGE o IPCA da alimentação no domicílio e multiplica os preços pela variação desde o mês dos preços. Ao trocar os preços do DIEESE, mude também `PRECOS_BASE`, no começo de `api/precos.php`, para o mesmo mês, no formato `202609`.

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
| Visual dos apps | `assets/css/apps.css` |
| Opções do pedido exclusivo e categorias da coleção | `assets/js/colecao-dados.js` |
| Fita métrica e camiseta 3D da página inicial | `assets/js/home-animacoes.js` |
| Textos de convite dos apps para quem não tem conta | `PORTOES`, em `assets/js/apps.js` |
| Medidas, faixas de valores e textos do guia | `assets/js/medidas-dados.js` |
| Perguntas e ordem da tabela | `assets/js/medidas-form.js` |
| Cores e fontes | início de `assets/css/style.css` |
| Banco, Google e e-mails | `api/config.php` |
| Textos das páginas | o arquivo `.html` de cada página |

Para acrescentar uma medida nova, além de `medidas-dados.js`, crie a coluna em `cadastros` no banco e inclua o nome dela em `api/perfil.php`.
