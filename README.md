# MenuReal AR — Cardápio digital com 3D e realidade aumentada

Demonstração funcional de um cardápio para padarias, lanchonetes e cafeterias:
o cliente gira o alimento em 3D e, em aparelhos compatíveis, abre a câmera para
vê-lo **em escala fixa** sobre a mesa. Padaria de exemplo: **Padaria Sabor da Vila**.

> Preços, medidas e modelos são **demonstrativos**. Os modelos 3D são
> ilustrações originais deste projeto, não digitalizações de alimentos reais.

---

## 1. Estrutura

```
menureal-ar/
├── index.html                      página do cardápio
├── style.css                       identidade visual (creme, verde-escuro, verde-limão)
├── app.js                          lógica: cardápio, busca, 3D/RA, carrinho, admin
├── assets/models/                  modelos GLB (glTF 2.0 binário, unidade = metro)
│   ├── coxinha.glb        5 × 5 × 9 cm  (em pé; altura 9 cm)
│   ├── pao-de-queijo.glb  5 × 5 × 4 cm
│   ├── pastel.glb        12 × 8 × 3 cm
│   ├── croissant.glb     12 × 7 × 5 cm
│   ├── empada.glb         8 × 8 × 4 cm
│   └── brigadeiro.glb     3 × 3 × 3 cm
├── netlify/functions/ler-cardapio.mjs  servidor: lê a foto do cardápio com a API do Claude
├── netlify.toml                    configuração da Netlify (site + funções)
├── vendor/model-viewer.min.js      cópia local do <model-viewer> 4.4.0 (reserva offline)
├── vendor/model-viewer-LICENSE.txt licença Apache-2.0 do model-viewer
├── tools/gerar_modelos.py          gera os 6 GLBs (Python + numpy + Pillow)
├── tools/gerar_arquivo_unico.py    gera a versão de arquivo único
├── menureal-ar-arquivo-unico.html  tudo em um arquivo (abre com duplo clique)
└── README.md
```

Medidas no formato **largura × profundidade × altura**. A coxinha foi modelada
em pé, por isso aparece como 5 × 5 × 9 cm (as mesmas medidas de 9 × 5 × 5 cm).

### Tecnologias
- HTML5, CSS3 e JavaScript puro (sem frameworks, sem build).
- [`<model-viewer>`](https://modelviewer.dev/) **4.4.0** (Google, Apache-2.0),
  carregado do CDN jsDelivr — `https://cdn.jsdelivr.net/npm/@google/model-viewer@4.4.0/dist/model-viewer.min.js` —
  com a cópia em `vendor/` como reserva automática se o CDN falhar.
- Fontes Fraunces e Manrope (Google Fonts). Sem internet, caem para fontes do sistema.

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

Os modelos 3D precisam ser servidos por HTTP (abrir o `index.html` direto do
disco bloqueia o carregamento dos GLBs — a página avisa quando isso acontece).

```bash
cd menureal-ar
python3 -m http.server 8080        # ou: npx serve .
```
Abra **http://localhost:8080**.

**Sem servidor:** dê duplo clique em `menureal-ar-arquivo-unico.html`. Tudo
funciona (cardápio, 3D, carrinho, admin), exceto a RA, que exige HTTPS.

Para testar no celular na mesma rede Wi-Fi, use `http://IP-do-computador:8080`
— o 3D funciona, mas a RA **não** (exige HTTPS). Use a publicação abaixo.

---

## 4. Publicar grátis em HTTPS

Qualquer hospedagem de site estático serve. Três opções gratuitas:

**Netlify Drop (mais simples, sem conta técnica)**
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `menureal-ar` inteira (ou o zip com o `index.html` na raiz).
3. Você recebe um endereço `https://….netlify.app`.

> O Netlify Drop publica só o site. A **leitura de cardápio por foto** precisa
> da função de servidor, que só roda em sites publicados a partir do GitHub
> (ou pela Netlify CLI). Veja a seção 7.

**GitHub Pages**
1. Crie um repositório e envie os arquivos (mantendo as pastas).
2. *Settings → Pages → Deploy from a branch → main / (root)*.
3. Endereço: `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

**Cloudflare Pages** — *Workers & Pages → Create → Pages → Upload assets*, envie a pasta.

GLB é servido corretamente por essas hospedagens. Em outros servidores,
configure o tipo `model/gltf-binary` para `.glb`.

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
2000 px), enviada para `netlify/functions/ler-cardapio.mjs`, que chama a API
do Claude (modelo **Claude Haiku 5.5**, saída em JSON estruturado). Os itens
aparecem numa tela de revisão: o dono corrige nome, preço e categoria,
desmarca o que não quiser e escolhe **Adicionar** ou **Substituir**. Depois,
**Salvar alterações**.

### O que você precisa
1. **Chave da API da Anthropic**: crie uma conta em https://console.anthropic.com,
   adicione créditos e gere uma chave em *API Keys*. O uso é pago por leitura
   (com o Haiku 5.5, uma foto custa uma fração de centavo de dólar; veja
   https://claude.com/pricing).
2. **Repositório no GitHub** com os arquivos do projeto (o Netlify Drop não roda funções).
3. **Site na Netlify importado do GitHub**: *Add new site → Import an existing
   project → GitHub →* escolha o repositório. Deixe o comando de build vazio;
   o `netlify.toml` já indica a pasta de publicação e a das funções.
4. **Variáveis de ambiente** em *Site configuration → Environment variables*:
   | Nome | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | a chave da Anthropic (secreta) |
   | `MENUREAL_CODIGO` | um código de acesso que você inventa (ex.: 8+ caracteres) |
   | `MENUREAL_MODELO` | opcional; ex.: `claude-sonnet-5-5` para cardápios difíceis |
   | `ANTHROPIC_WORKSPACE_ID` | só se a chave valer para vários workspaces (começa com `sk-ant-usr-`): o ID do workspace, `wrkspc_...` |
5. Após salvar as variáveis: *Deploys → Trigger deploy → Deploy site*.

### Diagnóstico
Abra `https://SEU-SITE.netlify.app/api/ler-cardapio` no navegador. Se o
servidor estiver publicado, aparece um texto com `"servidor":"ok"` e se a
chave e o código estão configurados (sem mostrar os valores). Se aparecer a
página "Page not found" da Netlify, a função não foi publicada: confira se o
site foi importado do GitHub, não pelo Netlify Drop.

### Segurança
- A chave da Anthropic fica só no servidor; nunca vai para o navegador.
- O código de acesso impede que estranhos usem a leitura por sua conta. Passe
  esse código apenas ao dono da padaria. Troque-o se vazar.
- Defina um limite de gasto mensal no console da Anthropic.
- A IA pode errar: a tela de revisão existe para isso. Preços não lidos
  aparecem em branco e precisam ser digitados.

### Limites conhecidos
- Uma foto por vez; cardápios grandes, uma foto por página.
- Funções de streaming da Netlify têm limite de 60 s por leitura.
- Fotos HEIC do iPhone podem não abrir em alguns navegadores; use a câmera
  pelo site ou JPG.
- Produtos importados entram sem modelo 3D (card compacto, só com o pedido).

---

## 8. O que ainda depende de backend ou serviços externos

| Recurso | Situação atual | O que falta |
|---|---|---|
| Pedidos | Demonstrativos; nada é enviado | API de pedidos + painel da cozinha |
| Pagamento | Não existe (intencional) | Gateway (Pix, cartão) com conformidade |
| WhatsApp | Link `wa.me` opcional com o resumo | Número oficial; WhatsApp Business API para automação |
| Administração | Só no navegador (`localStorage`), sem login | Autenticação, banco de dados, sincronização |
| Cardápio por foto | Funciona com a função da Netlify + chave da Anthropic | Login por padaria em vez de código compartilhado |
| Cardápio entre aparelhos | Exportar/Importar JSON manual | Banco de dados ou CMS |
| Modelos 3D | Arquivos estáticos | Armazenamento/CDN e fluxo de upload |
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
- Código do MenuReal AR e modelos em `assets/models/`: originais deste projeto (modelos em CC0 1.0).
- `<model-viewer>`: Apache-2.0, © Google LLC (inclui three.js, MIT).
- Fontes Fraunces e Manrope: SIL Open Font License.
