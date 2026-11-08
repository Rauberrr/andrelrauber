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
- **Peças sugeridas:** cada pessoa recebe as peças da lista `GR_SUGERIDAS`, em `api/guarda-roupa.php`, na primeira vez que abre o guarda-roupa. As fotos sem fundo ficam em `assets/img/sugeridas`, e as originais, em `imagens-guarda-roupa`, fora do GitHub. Para acrescentar uma peça, inclua a foto e a linha na lista: quem já tem conta também a recebe.
- **Peças excluídas:** ficam na aba Excluídas, com as fotos, até a pessoa adicionar de novo ou apagar de vez. As sugeridas só saem junto com a conta, porque a foto é da marca.
- **Várias peças de uma vez:** em **Adicionar várias**, a pessoa faz todas as fotos, descreve cada uma enquanto o fundo sai em segundo plano e guarda até 20 de cada vez. O código fica em `assets/js/guarda-roupa-lote.js`.
- **Looks:** as regras de cor, ocasião, clima e caimento estão em `assets/js/guarda-roupa-looks.js`. As listas de tipos, cores e cortes estão em `assets/js/guarda-roupa-dados.js` e `api/guarda-roupa.php`, que precisam ficar iguais.
- **Limites:** 60 peças próprias por pessoa, 120 somando as excluídas, 80 envios por hora e 300 looks com nome ou observação, definidos em `api/guarda-roupa.php`. As sugeridas não contam.
- **Nome e observação dos looks:** ficam na tabela `looks_notas`. Dar nome a uma sugestão também a guarda em Salvos.

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

## Alimentação

Em `alimentacao.html`, a pessoa informa sexo, idade, altura, peso, rotina, objetivo e estado, marca o que come num dia comum e recebe:

- o gasto calórico, pela fórmula de Mifflin-St Jeor, e uma meta com déficit ou superávit moderado;
- um plano, com trocas saudáveis no que ela já come ou montado do zero;
- a lista de compras, com quanto dura cada embalagem, de quanto em quanto tempo comprar e o custo por mês, comparando o plano com o que ela come hoje.

Os dados ficam no navegador da pessoa. Quem tem conta pode autorizar que também fiquem na conta, na tabela `alimentacao`, para abrir em qualquer aparelho. Como são dados de saúde, o servidor só guarda com essa autorização, aceita apenas os campos que a página usa e não mostra nada disso no painel, só o fato de a pessoa ter autorizado. Depois de terminar as perguntas, a pessoa cai num resumo, de onde altera qualquer parte. Os valores nutricionais são aproximados da Tabela Brasileira de Composição de Alimentos (TACO).

### Atualizar os preços

Os preços ficam em `assets/js/alimentacao-dados.js`.

1. **Cesta básica (13 itens):** em [dieese.org.br/cesta](https://www.dieese.org.br/cesta), aba **Banco de Dados**, escolha a consulta por data, o mês mais recente, **Preço médio** e todos os produtos e cidades. Copie os valores para a tabela `DIEESE` e atualize `DIEESE_DATA`.
2. **Demais produtos:** cada um tem um preço `base`, que é um preço comum de prateleira, sem promoção. Revise esses valores a cada poucos meses. A página ajusta esses preços pela região, comparando os preços do DIEESE de cada capital com a média.
3. **Salário mínimo:** atualize `SALARIO_MINIMO` todo começo de ano.

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
| Medidas, faixas de valores e textos do guia | `assets/js/medidas-dados.js` |
| Perguntas e ordem da tabela | `assets/js/medidas-form.js` |
| Cores e fontes | início de `assets/css/style.css` |
| Banco, Google e e-mails | `api/config.php` |
| Textos das páginas | o arquivo `.html` de cada página |

Para acrescentar uma medida nova, além de `medidas-dados.js`, crie a coluna em `cadastros` no banco e inclua o nome dela em `api/perfil.php`.
