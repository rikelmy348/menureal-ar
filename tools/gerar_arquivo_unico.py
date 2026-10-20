#!/usr/bin/env python3
"""
Gera menureal-ar-arquivo-unico.html: o projeto inteiro em um só arquivo
(CSS, JS, biblioteca <model-viewer> e os seis modelos GLB embutidos).

Serve para TESTAR A INTERFACE abrindo o arquivo direto no navegador,
sem servidor. Para a realidade aumentada, publique o projeto em HTTPS.

Uso:  python3 tools/gerar_arquivo_unico.py
"""
import base64
import os
import re

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def ler(caminho):
    with open(os.path.join(RAIZ, caminho), encoding="utf-8") as f:
        return f.read()


def seguro(js):
    # evita que sequências do JS encerrem a tag <script> antes da hora
    return js.replace("</script", "<\\/script").replace("<!--", "<\\!--")


html = ler("public/index.html")
css = ler("public/style.css")
app = ler("public/app.js")
mv = ler("public/vendor/model-viewer.min.js")

modelos = {}
pasta = os.path.join(RAIZ, "public", "assets", "models")
for nome in sorted(os.listdir(pasta)):
    if nome.endswith(".glb"):
        with open(os.path.join(pasta, nome), "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        modelos["assets/models/" + nome] = "data:model/gltf-binary;base64," + b64

with open(os.path.join(RAIZ, "public", "assets", "estudio.hdr"), "rb") as f:
    modelos["assets/estudio.hdr"] = "data:application/octet-stream;base64," + base64.b64encode(f.read()).decode("ascii") + "#.hdr"  # o model-viewer reconhece HDR pelo final ".hdr"

mapa = ",\n".join('  "%s": "%s"' % (k, v) for k, v in modelos.items())

with open(os.path.join(RAIZ, "public", "vendor", "fontes", "bricolage-grotesque.woff2"), "rb") as f:
    fonte = "data:font/woff2;base64," + base64.b64encode(f.read()).decode("ascii")
css = css.replace('url("vendor/fontes/bricolage-grotesque.woff2")', 'url("' + fonte + '")')
html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
html = html.replace('<base href="/">', "")
html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
html = re.sub(r"if \(location\.protocol === 'file:'\) \{.*?\n    \}\n", "", html, flags=re.S)
html = html.replace(
    '<script src="app.js" defer></script>',
    "<script>\nwindow.MENUREAL_MV_EMBUTIDO = true;\nwindow.MENUREAL_MODELOS = {\n" + mapa + "\n};\n</script>\n"
    '<script type="module">\n' + seguro(mv) + "\n</script>\n"
    "<script>\n" + seguro(app) + "\n</script>",
)
destino = os.path.join(RAIZ, "menureal-ar-arquivo-unico.html")
with open(destino, "w", encoding="utf-8") as f:
    f.write(html)
print("Gerado:", destino, "(%.1f MB)" % (os.path.getsize(destino) / 1e6))
