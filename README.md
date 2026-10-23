# MenuReal AR — Cardápio digital com 3D e realidade aumentada

Plataforma para qualquer loja que queira mostrar produtos em 3D e em tamanho
real: comida (padarias, confeitarias, restaurantes) e também objetos (móveis,
decoração, eletrônicos, presentes). Cada loja tem conta e endereço próprios e
escolhe o **tipo de negócio**: *Comida e bebida* (cardápio, ingredientes e
alérgicos) ou *Produtos e objetos* (catálogo, composição/materiais, medidas até
10 m).

Demonstração funcional de um cardápio para padarias, lanchonetes e cafeterias:
o cliente gira o alimento em 3D e, em aparelhos compatíveis, abre a câmera para
vê-lo **em escala fixa** sobre a mesa. Padaria de exemplo: **Padaria Sabor da Vila**.

> Preços, medidas e modelos são **demonstrativos**. Os modelos 3D são
> ilustrações originais deste projeto, não digitalizações de alimentos reais.

---

## 1. Estrutura

```
menureal-ar/
├── public/                          tudo o que o navegador baixa
│   ├── index.html                   página do cardápio/catálogo
│   ├── style.css                    identidade visual (claro e escuro)
│   ├── app.js                       lógica: cardápio, busca, 3D/RA, carrinho, admin
│   ├── assets/models/               modelos GLB de demonstração (unidade = metro)
│   │   ├── coxinha.glb        5 × 5 × 9 cm  (em pé; altura 9 cm)
│   │   ├── pao-de-queijo.glb  5 × 5 × 4 cm
│   │   ├── pastel.glb        12 × 8 × 3 cm
│   │   ├── croissant.glb     12 × 7 × 5 cm
│   │   ├── empada.glb         8 × 8 × 4 cm
│   │   └── brigadeiro.glb     3 × 3 × 3 cm
│   └── vendor/                      <model-viewer> 4.4.0 (reserva) e fonte Bricolage Grotesque
├── src/                             servidor (Cloudflare Worker)
│   ├── worker.mjs                   entrada: /api/* vai para as funções, o resto para public/
│   ├── api/cardapio.mjs             cardápio de cada loja (GET público / PUT com login)
│   ├── api/contas.mjs               dono da plataforma cria contas das lojas
│   ├── api/entrar.mjs               login do estabelecimento (e-mail e senha)
│   ├── api/ler-cardapio.mjs         lê a foto do cardápio com a API do Claude
│   ├── api/modelo-3d.mjs            gera modelo 3D realista por fotos (Meshy)
│   ├── api/combo.mjs                junta os itens do pedido em um só 3D
│   ├── api/arquivo.mjs              entrega os modelos 3D e as imagens guardados no KV
│   ├── api/imagem.mjs               recebe a logo e a foto de capa da loja
│   ├── api/montagem.mjs             junta copo + adicionais para abrir na câmera
│   ├── lib/banco.mjs                banco de dados D1 (cria as tabelas sozinho)
│   └── lib/comum.mjs                login (WebCrypto), escala e combo de GLB
├── wrangler.jsonc                   configuração da Cloudflare (site, banco, arquivos 3D)
├── package.json                     ferramenta de publicação (wrangler)
├── tools/gerar_modelos.py           gera os 6 GLBs (Python + numpy + Pillow)
├── tools/gerar_arquivo_unico.py     gera menureal-ar-arquivo-unico.html (tudo em um arquivo)
└── README.md
```

Medidas no formato **largura × profundidade × altura**. A coxinha foi modelada
em pé, por isso aparece como 5 × 5 × 9 cm (as mesmas medidas de 9 × 5 × 5 cm).

### Tecnologias
- HTML5, CSS3 e JavaScript puro (sem frameworks, sem build).
- [`<model-viewer>`](https://modelviewer.dev/) **4.4.0** (Google, Apache-2.0),
  carregado do CDN jsDelivr — `https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js` —
  com a cópia em `public/vendor/` como reserva automática se o CDN falhar.
- Fonte Bricolage Grotesque hospedada no próprio site (`public/vendor/fontes/`).
- Servidor: **Cloudflare Workers** + **D1** (banco SQLite) + **KV** (arquivos 3D).

---

## 2. Modelos 3D: de onde vieram e licença

Não encontrei modelos de **coxinha, pão de queijo, pastel, empada e brigadeiro**
com licença aberta e procedência verificável que eu pudesse baixar e conferir
daqui. Em vez de usar objetos de outra coisa ou inventar links, **os seis
modelos foram criados para este projeto** por geometria procedural
(`tools/gerar_modelos.py`):

- São **ilustrativos**: a forma lembra o alimento, mas não é uma digitalização.
  O cardápio exibe o selo “Modelo ilustrativo” em cada um.
- **Escala real de verdade, não CSS**: cada arquivo é gravado em metros e
  escalado para que a caixa delimitadora seja exatamente a medida cadastrada
  (ex.: brigadeiro = 0,03 m). Os metadados do GLB (`asset.extras`) registram as medidas.
- Licença: **CC0 1.0** (domínio público) — use, altere e distribua livremente.
- Para regenerar: `pip install numpy pillow && python3 tools/gerar_modelos.py`

O visualizador **confere a escala sozinho**: ao abrir um produto, ele mede o
arquivo (`getDimensions()`) e compara com o cadastro. Se a diferença passar de
5%, mostra um aviso — útil quando você trocar por modelos reais.

### Onde obter modelos reais (com licença verificável)
- **Fotogrametria própria (recomendado)**: fotografe o produto real da padaria
  com apps como Polycam, Luma AI, KIRI Engine ou RealityScan e exporte em GLB.
  É o único jeito de o “tamanho real” representar o produto de verdade.
- **Sketchfab** (https://sketchfab.com) — filtre por *Downloadable* e licença
  **CC0** ou **CC BY** (CC BY exige crédito ao autor). Confira a licença de cada modelo.
- **Poly Haven** (https://polyhaven.com/models) — modelos CC0, poucos alimentos.
- Modelo genérico apenas para teste técnico: os modelos de exemplo oficiais do
  Khronos (https://github.com/KhronosGroup/glTF-Sample-Assets) — não use como alimento.

---

## 3. Executar localmente

Com Node.js 20 ou mais novo:

```bash
cd menureal-ar
npm install
npx wrangler dev          # site + servidor + banco local em http://localhost:8787
```

O `wrangler dev` cria um banco D1 e um KV **locais** (pasta `.wrangler/`), sem
precisar de conta. Para as chaves, crie um arquivo `.dev.vars` (já ignorado
pelo Git) com, por exemplo, `MENUREAL_CODIGO=um-codigo-de-teste`.

**Só a interface, sem servidor:** gere e abra o arquivo único:
`python3 tools/gerar_arquivo_unico.py` → duplo clique em
`menureal-ar-arquivo-unico.html`. Cardápio, 3D, carrinho e admin local
funcionam; a RA exige HTTPS.

---

## 4. Publicar na Cloudflare (grátis, HTTPS)

O site e o servidor saem do mesmo **Worker**, publicado a partir do GitHub.
Não precisa de cartão de crédito.

1. Crie a conta em https://dash.cloudflare.com/sign-up e confirme o e-mail.
2. *Compute (Workers) → Workers & Pages → Create → Import a repository* (ou
   *Continue with GitHub*) → autorize o GitHub → escolha `menureal-ar`.
3. Confira: nome `menureal-ar`, comando de build **vazio**, comando de deploy
   `npx wrangler deploy`. Clique em **Deploy**.
   Na primeira publicação a Cloudflare **cria sozinha** o banco D1 `menureal`
   e o KV dos modelos 3D, e liga os dois ao Worker.
4. No Worker: *Settings → Variables and Secrets → Add*, tipo **Secret**, uma por vez
   (tabela na seção 7). Salve com **Deploy**.
5. Endereço: `https://menureal-ar.SEU-SUBDOMINIO.workers.dev`. Cada `git push`
   na branch `main` publica de novo sozinho.

> Se a criação automática do banco falhar: *Storage & Databases → D1 → Create*
> com o nome `menureal`; copie o *Database ID* e coloque
> `"database_id": "..."` dentro de `d1_databases` no `wrangler.jsonc`. Faça o
> mesmo com *KV → Create* (`"id": "..."` em `kv_namespaces`). IDs não são secretos.

**Limites do plano gratuito (Workers Free):** 100 mil requisições por dia,
10 ms de processamento por requisição, D1 com 5 GB, KV com 1 GB e 1.000
gravações por dia. Para uma ou poucas lojas sobra. Se a geração de 3D de
arquivos grandes falhar por limite de processamento (“Exceeded CPU”), o
**Workers Paid** (US$ 5/mês) libera 30 s por requisição e limites bem maiores.

---

## 5. Testar 3D e RA no Android

Requisitos: Android com **Chrome** atualizado e **Google Play Services para RA**
(ARCore) instalado. Lista de aparelhos compatíveis:
https://developers.google.com/ar/devices

1. Abra o endereço **HTTPS** publicado no Chrome.
2. Toque em **Ver em 3D**: arraste para girar, pinça para zoom.
3. Volte e toque em **Ver em tamanho real** → leia as instruções → toque em
   **Abrir câmera · tamanho real**.
4. Aponte para uma mesa iluminada, mova o celular devagar e toque para posicionar.
5. Meça com uma régua: o brigadeiro deve ter ~3 cm; o croissant ~12 cm.
6. Saia com o botão de fechar ou “voltar”.

O `<model-viewer>` tenta, nesta ordem: **Scene Viewer** (visualizador nativo
do Google, que fixa o objeto na mesa com mais estabilidade) → **WebXR** (dentro
do Chrome) → **Quick Look** (iPhone/iPad, Safari). A ordem fica em
`ar-modes` no `app.js`.
O botão de câmera só aparece quando o aparelho oferece algum desses modos;
caso contrário, a aba “Ver em tamanho real” explica o motivo e mantém o 3D.

**iPhone/iPad:** use o Safari. O `<model-viewer>` converte o GLB para USDZ
automaticamente. Para a melhor fidelidade, você pode exportar um `.usdz` e
adicioná-lo com o atributo `ios-src` (ver seção 6).

O comportamento varia entre aparelhos — teste sempre em celulares reais.

---

## 6. Substituir um modelo de demonstração por um alimento real

1. **Meça o produto real** (largura, profundidade, altura em cm).
2. **Prepare o GLB** no Blender (gratuito):
   - *Scene → Units*: sistema Métrico, escala 1,0 (1 unidade = 1 metro).
   - Ajuste o objeto às medidas reais (ex.: 0,09 m de altura), apoiado em Z=0
     no Blender (vira Y=0 no glTF) e centralizado.
   - *Object → Apply → All Transforms*.
   - *File → Export → glTF 2.0 (.glb)*, com “+Y Up” marcado.
   - Mantenha o arquivo leve: até ~2–5 MB, texturas de 1024–2048 px.
3. **Coloque o arquivo** em `assets/models/`, por exemplo `coxinha.glb`
   (mesmo nome = troca direta, nada mais a fazer).
4. Ou, com outro nome: **Admin → produto → Arquivo 3D (.glb)** →
   `assets/models/coxinha-real.glb` → Salvar. Para valer para todos os
   aparelhos, altere também o campo `modelo` em `PADRAO` no `app.js`.
5. Atualize as medidas cadastradas, desmarque “Modelo ilustrativo” e abra o
   produto: o visualizador deve mostrar **“✓ Escala conferida”**.
6. Opcional (iPhone): exporte um `.usdz` e adicione em `abrirViewer()` no
   `app.js`: `attrs['ios-src'] = 'assets/models/coxinha.usdz';`

Dica: confira o arquivo em https://modelviewer.dev/editor/ antes de publicar.

---

## 7. Criar cardápio por foto (servidor)

No painel administrativo, **Criar a partir de uma foto do cardápio** permite
fotografar o cardápio impresso. A foto é reduzida no próprio celular (até
2000 px), enviada para `src/api/ler-cardapio.mjs`, que chama a API
do Claude (modelo **Claude Haiku 5.5**, saída em JSON estruturado). Os itens
aparecem numa tela de revisão: o dono corrige nome, preço e categoria,
desmarca o que não quiser e escolhe **Adicionar** ou **Substituir**. Depois,
**Salvar alterações**.

### O que você precisa
1. **Chave da API da Anthropic**: crie uma conta em https://console.anthropic.com,
   adicione créditos e gere uma chave em *API Keys*. O uso é pago por leitura
   (com o Haiku 5.5, uma foto custa uma fração de centavo de dólar; veja
   https://claude.com/pricing).
2. **Repositório no GitHub** ligado ao Worker na Cloudflare (seção 4).
3. **Variáveis e segredos** do Worker em *Settings → Variables and Secrets*
   (tipo *Secret*; nunca coloque chaves no código nem as envie por chat):
   | Nome | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | a chave da Anthropic |
   | `MENUREAL_CODIGO` | um código de acesso que você inventa (ex.: 8+ caracteres) |
   | `MESHY_API_KEY` | chave da API da Meshy, para gerar modelos 3D realistas por fotos |
   | `ANTHROPIC_WORKSPACE_ID` | só se a chave valer para vários workspaces (começa com `sk-ant-usr-`): o ID `wrkspc_...` |
   | `MENUREAL_SEGREDO` | opcional: texto longo aleatório para assinar os logins |
   | `MENUREAL_MODELO` | opcional; ex.: `claude-sonnet-5-5` para cardápios difíceis |
4. Ao salvar, a Cloudflare publica de novo com as variáveis. O `wrangler.jsonc`
   tem `keep_vars`, então os próximos `git push` não apagam nada.

### Diagnóstico
Abra `https://SEU-SITE/api/ler-cardapio` no navegador. Aparece um texto com
`"servidor":"ok"`, `"hospedagem":"cloudflare"`, se a chave e o código estão
configurados (sem mostrar os valores), `"banco_de_dados_ok"` e
`"arquivos_3d_ok"`. Se der erro 404 ou a página do cardápio, o Worker não foi
publicado a partir do repositório: confira *Deployments* no painel.

### Segurança
- A chave da Anthropic fica só no servidor; nunca vai para o navegador.
- O código de acesso impede que estranhos usem a leitura por sua conta. Passe
  esse código apenas ao dono da padaria. Troque-o se vazar.
- Defina um limite de gasto mensal no console da Anthropic.
- A IA pode errar: a tela de revisão existe para isso. Preços não lidos
  aparecem em branco e precisam ser digitados.

### Limites conhecidos
- Uma foto por vez; cardápios grandes, uma foto por página.
- Fotos HEIC do iPhone podem não abrir em alguns navegadores; use a câmera
  pelo site ou JPG.
- Produtos importados entram sem modelo 3D (card compacto, só com o pedido).

---

## 7b. Cardápio na nuvem e modelos 3D realistas

**Publicação para todos:** no painel, com o código de acesso preenchido,
*Salvar alterações* envia o cardápio para `/api/cardapio`, guardado no
**banco D1**. Ao abrir o site, todo cliente carrega essa versão.

**Modelo 3D por fotos:** em cada produto, *Gerar 3D realista com fotos*.
O dono tira de 1 a 4 fotos (a primeira de frente). O servidor envia as fotos
para a API *Multi-Image to 3D* da **Meshy**, acompanha o progresso, baixa o
GLB, **ajusta a escala** para que a maior dimensão seja a maior medida
cadastrada (mantendo as proporções), apoia a base no chão, guarda o arquivo no
**KV** da Cloudflare (até 25 MB por modelo) e devolve o endereço `api/arquivo/modelos/...glb`. Depois: *Usar este
modelo* → *Salvar alterações*.

**Qualidade:** *Alta* (padrão) pede à Meshy geometria detalhada (`geometry_resolution: 2k`,
~100 mil triângulos), texturas 2K com PBR e remoção da luz das fotos (`remove_lighting`), para
que a iluminação venha da cena e da câmera na RA. *Padrão* gera ~40 mil triângulos e abre mais
rápido em internet fraca. Ao guardar, o servidor ajusta os materiais: comida nunca fica
metálica nem brilhante demais (evita aspecto de plástico).

**Iluminação:** os visualizadores usam `public/assets/estudio.hdr`, uma luz de estúdio
fotográfico criada para o projeto (`tools/gerar_estudio_hdr.py`, CC0), com mapeamento de tons
neutro (cores fiéis) e sombra de contato mais firme. Na câmera (RA), a luz é a do ambiente real.

Para ativar: crie conta em https://www.meshy.ai, compre créditos de API,
gere a chave em *API* e cadastre `MESHY_API_KEY` no Worker. Cada modelo com
textura custa cerca de 30 créditos (confira a página de preços da Meshy).
Qualidade depende das fotos: fundo liso, boa luz, produto inteiro no quadro.

## 7c. Plataforma para vários estabelecimentos

**Endereços:** a página inicial (`/`) é a demonstração. Cada cliente tem o
cardápio em `https://SEU-SITE/<endereço>`, por exemplo `/doce-lar`.

**Criar a conta de um cliente (você, dono da plataforma):** na página inicial,
*Admin* → código de acesso (`MENUREAL_CODIGO`) → *Ver e criar
estabelecimentos* → nome, endereço, e-mail e senha inicial → *Criar conta*.
Usar o mesmo endereço de novo redefine o e-mail e a senha.

**O cliente edita o próprio cardápio:** abre `/<endereço>` → *Admin* → entra
com e-mail e senha. Ele só consegue alterar a própria loja. O login vale 30
dias neste aparelho. Senhas ficam guardadas com hash (PBKDF2-SHA256), nunca em texto.

**Categorias:** cada loja define as suas (ex.: Bolos, Tortas, Doces, Bebidas)
no painel, separadas por vírgula. A leitura de cardápio por foto usa essas
categorias.

**Ingredientes e alérgicos:** cada produto tem campo de ingredientes e a
lista de alérgenos de declaração obrigatória (RDC Anvisa 26/2015, agrupada):
glúten, leite, ovos, soja, amendoim, castanhas e nozes, peixes, crustáceos e
látex natural. Aparecem no card (“Contém: …”) e no visualizador.

**Tamanhos (P, M, G…):** cada produto pode ter até 8 tamanhos com preço e
medidas próprios. Depois de ter o 3D do produto, *Gerar 3D de cada tamanho*
cria um arquivo na escala de cada tamanho (sem gastar créditos). O cliente
escolhe o tamanho no visualizador, vê o preço e o tamanho real na câmera, e o
pedido registra o tamanho.

**Combo na mesa:** no carrinho, com 2 ou mais itens com 3D, *Ver o pedido na
mesa (3D)* junta os itens (até 8 unidades) lado a lado num único arquivo, em
tamanho real, com o preço total. Funciona também no Scene Viewer e no Quick Look.

**Aparência de cada loja:** no painel, *Aparência da página*:
- **Cores**: 9 combinações prontas ou cor principal (botões) e de destaque (régua) livres.
  O site calcula sozinho a cor do texto sobre cada cor e a versão do modo escuro.
- **Estilo das letras dos títulos**: Moderno (Bricolage Grotesque), Elegante
  (Playfair Display), Divertido (Fredoka) ou Clássico (Lora). Todas hospedadas no site.
- **Logo** (topo da página) e **foto de capa**: o celular reduz a imagem antes de
  enviar; ficam no KV em `/api/arquivo/imagens/<loja>/...`.
- **Marca MenuReal**: a loja escolhe se mostra “Cardápio em 3D por MenuReal” no rodapé.
  Na página da loja, o topo mostra a logo ou o nome dela, nunca o MenuReal.

**Monte o seu (açaí, sorvete, lanche…):** cada produto pode ter **adicionais** com preço
(granola +R$ 2, leite condensado +R$ 2,50…). No painel, *Lista pronta de açaí* preenche os mais
comuns. Com *Aparece no 3D*, o adicional **cai em cima do produto** com animação quando o cliente
marca; o preço soma na hora e o pedido registra cada adicional. Em *Abrir câmera*, o servidor
junta copo e coberturas num arquivo só (`/api/montagem`, guardado no KV) e o açaí montado aparece
na mesa, no tamanho real. Os copos de vidro de 300, 500 e 700 ml (com o açaí aparecendo pelo vidro e a calda
escorrendo por dentro) e as coberturas são modelos ilustrativos originais (`tools/gerar_acai.py`, CC0).
Cada pedaço é animado: frutas e granola caem girando e quicam, a calda é "desenhada"
sobre o açaí e escorre pelo vidro, o leite em pó forma um montinho. Na tela, uma **mão** chega por trás do copo e solta frutas, granola e
confetes da pinça, e um **frasco de vidro** passa por cima despejando as caldas
(`public/assets/adicionais/_mao.glb` e `_frasco_*.glb`; não vão para a câmera); o copo também pode ser o 3D gerado pela foto da loja.
**Copo 3D sob medida (o copo da própria loja):** no produto, em *Copo 3D sob medida*, a loja
escolhe plástico ou vidro e informa, por tamanho, os **ml** (as medidas vêm sozinhas) ou as
medidas medidas com régua (boca, fundo, altura). *Gerar copo 3D e ligar o montador* cria um
copo 3D com essas medidas — com a **logo da loja estampada**, se ela tiver logo — no próprio
navegador (`gerarCopo` em `public/glb.mjs`), envia para `/api/copo` (guardado no KV), coloca
o copo em cada tamanho e liga o montador. Basta salvar.

**O cliente monta o copo:** no produto, marque *O cliente monta o copo em camadas*. No
cardápio, o cliente começa com o copo vazio e vai tocando em **+ Açaí**, **+ Banana**,
**+ Creme de ninho**… — cada toque põe uma camada por cima (pode repetir), com animação: a
camada sobe e os pedaços caem dentro do copo. Um medidor mostra quanto falta; *Desfazer*
tira a última camada e *Completar com açaí* termina o copo. Cheio, ele escolhe o que vai
**por cima** (coberturas) e só então pode adicionar ao pedido. Cada camada cobra o preço do
adicional (açaí incluso no tamanho) e o pedido lista as camadas em ordem.

**Açaí em camadas (como o de copo):** adicionais do tipo *Camada … (dentro do copo)*
— creme, morango picado com creme e Nutella — montam o copo de baixo para cima: açaí,
camada, açaí, camada…, com as divisões onduladas e borradas no plástico, e os pedaços de
morango encostados no copo. Na tela, o copo **enche camada por camada**; as coberturas
aparecem no fim. As camadas são geradas em `public/glb.mjs` a partir das medidas gravadas
no próprio copo (`acai-pet-*.glb` e `acai-*.glb`); vale também para a câmera.
O morango é um **volume 3D com cor em cada ponto** (miolo, raios, polpa, casca com
sementes em covinhas): fatias, metades e cubinhos são cortes desse volume.

O tipo de loja *Sorveteria e açaí* já cria as categorias Açaí, Sorvetes, Picolés, Milkshakes e Bebidas.

Variável opcional: `MENUREAL_SEGREDO` (texto longo aleatório) para assinar os
logins. Sem ela, a assinatura usa o `MENUREAL_CODIGO`; trocar qualquer um dos
dois desconecta todas as lojas.

## 7e. Pedidos, entrega, Pix, esgotado e cartaz com QR Code

No painel da loja, seção **Pedidos, entrega e pagamento**:

- **Entrega, retirada e/ou consumo no local**; taxa fixa ou **taxa por bairro** (`Bairro = taxa`, um por linha — com a lista, só entrega nesses bairros); **pedido mínimo**; tempo de entrega; endereço para retirada.
- **Pagamento**: Pix, cartão (na entrega/retirada) e dinheiro com troco.
- **Chave Pix (opcional)**: o cliente recebe o **Pix copia e cola e o QR já com o valor do pedido** (BR Code do Banco Central, gerado no navegador). O dinheiro vai direto para a conta da loja; não há confirmação automática — a loja confere o comprovante. Botão "Testar a chave" gera um Pix de R$ 0,01 para conferir o nome no app do banco.
- **Fora do horário**: não aceitar pedidos ou aceitar "para quando abrir". Horário pode passar da meia-noite (ex.: 14h às 0h30). **Pausar pedidos agora** para imprevistos.
- **Esgotado**: em cada produto e em cada adicional. Aparece no cardápio, mas não dá para pedir.

O cliente: carrinho → **Continuar** → nome, entrega/retirada, endereço/bairro, pagamento → **Enviar pedido pelo WhatsApp** (mensagem completa com endereço, taxa, total e pagamento). Nome e endereço ficam salvos no aparelho dele para a próxima vez.

**Cartaz com QR Code**: no painel, "Criar cartaz com QR Code" gera uma imagem A4 com as cores e a logo da loja e o link do cardápio (baixar PNG ou imprimir). Gerador de QR: `vendor/qrcode.js` (qrcode-generator, MIT, Kazuhiko Arase).

## 7d. Banco de dados

Os dados ficam no **Cloudflare D1** (SQLite gerenciado). As tabelas são
criadas **sozinhas** na primeira requisição (`src/lib/banco.mjs`); não há
comando de migração para rodar.

| Tabela | Conteúdo |
|---|---|
| `lojas` | uma linha por loja: endereço, nome, login (e-mail e senha com hash), tipo, horário, WhatsApp, categorias (JSON). A demonstração da página inicial é a linha `_demo` |
| `produtos` | produtos de cada loja: preço, medidas, modelo 3D, ingredientes, alérgicos e tamanhos (JSON) |
| `tarefas_3d` | resultado das gerações 3D (evita gerar e cobrar duas vezes) |
| `configuracao` | versão do esquema e controles internos |

Os **arquivos 3D** gerados ficam no **KV** (`MODELOS`) e são entregues em
`/api/arquivo/...` com cache longo.

**Salvar é atômico:** o cardápio inteiro é gravado numa única transação; se
algo falhar, a versão anterior continua valendo.

**Conferir:** `https://SEU-SITE/api/ler-cardapio` mostra `"banco_de_dados_ok": true`.
O conteúdo das tabelas aparece em *Storage & Databases → D1 → menureal → Explore Data*.

**Mudar o esquema:** acrescente o comando em `ESQUEMA` (use `ALTER TABLE …`
para colunas novas) e aumente `VERSAO_ESQUEMA` em `src/lib/banco.mjs`.

**Vindo da Netlify:** contas e cardápios não são copiados automaticamente.
Recrie as contas pelo painel mestre (*Ver e criar estabelecimentos*); cada
loja pode usar *Exportar/Importar JSON* no painel para levar o cardápio.

## 8. O que ainda depende de backend ou serviços externos

| Recurso | Situação atual | O que falta |
|---|---|---|
| Pedidos | Demonstrativos; nada é enviado | API de pedidos + painel da cozinha |
| Pagamento | Não existe (intencional) | Gateway (Pix, cartão) com conformidade |
| WhatsApp | Link `wa.me` opcional com o resumo | Número oficial; WhatsApp Business API para automação |
| Administração | Banco de dados D1, login por loja | Recuperação de senha por e-mail; cadastro feito pela própria loja |
| Cardápio por foto | Funciona com o Worker + chave da Anthropic, login por loja | Limite de leituras por loja |
| Modelos 3D | Gerados por fotos (Meshy) e guardados no KV | Upload direto de GLB próprio |
| Estoque, horário real, métricas | Horário demonstrativo | Integração com PDV/sistema da padaria |
| Fontes e biblioteca 3D | CDN público (com reserva local) | Opcional: servir tudo do próprio domínio |

---

## 9. Testes antes de apresentar a uma padaria

**Aparelhos e navegadores**
- [ ] Android intermediário e topo de linha (Chrome) — 3D e RA.
- [ ] Android sem ARCore — mensagem de RA indisponível aparece e o 3D segue funcionando.
- [ ] iPhone com Safari — 3D e Quick Look.
- [ ] Navegador dentro do Instagram/WhatsApp (QR code) — costuma bloquear RA; verificar mensagem.
- [ ] Computador (Chrome, Safari, Firefox, Edge) — 3D sem botão de câmera.

**Escala e RA**
- [ ] Medir com régua cada produto em RA (tolerância aceitável definida com o cliente).
- [ ] “✓ Escala conferida” em todos os produtos.
- [ ] Posicionar em mesa clara, escura, de vidro e em pouca luz.
- [ ] Entrar e sair da RA várias vezes; voltar ao cardápio sem travar.

**Desempenho**
- [ ] Carregamento em 4G (DevTools → “Fast 4G”) e em rede ruim.
- [ ] Peso dos GLBs (ideal < 3 MB cada) e tempo até o primeiro modelo.
- [ ] Rolagem fluida com todos os cards; memória após abrir/fechar 10 modelos.

**Erros**
- [ ] Modelo inexistente (caminho errado no admin) → mensagem clara.
- [ ] Sem internet após carregar → biblioteca reserva local / aviso.
- [ ] `localStorage` bloqueado (aba anônima) → app continua utilizável.

**Funcionalidade**
- [ ] Busca com e sem acento (“pao” encontra “Pão de queijo”).
- [ ] Categorias, incluindo categoria vazia (Bebidas).
- [ ] Carrinho: adicionar, +/−, remover, total, finalizar, persistência ao recarregar.
- [ ] Admin: editar, adicionar, remover, validar campos, restaurar, exportar/importar.
- [ ] Cardápio por foto: cardápio impresso, quadro-negro, escrito à mão, foto torta e foto que não é cardápio; código errado; conferir preços um a um.
- [ ] Botão “voltar” do Android fecha janelas sem sair do site.

**Acessibilidade e conteúdo**
- [ ] Leitor de tela (TalkBack/VoiceOver) e navegação só por teclado.
- [ ] Zoom do sistema em 200% e fonte grande.
- [ ] “Reduzir movimento” ativado (sem auto-rotação nem animações).
- [ ] Modo escuro do sistema.
- [ ] Preços, descrições, alergênicos e medidas validados pela padaria.

---

## Licenças
- Código do MenuReal AR e modelos em `public/assets/models/`: originais deste projeto (modelos em CC0 1.0).
- `<model-viewer>`: Apache-2.0, © Google LLC (inclui three.js, MIT).
- Fontes Bricolage Grotesque, Playfair Display, Fredoka e Lora: SIL Open Font License (`public/vendor/fontes/OFL.txt` e `CREDITOS.txt`).
