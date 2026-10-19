#!/usr/bin/env python3
"""
MenuReal AR — gerador dos modelos 3D de demonstração (GLB).

Gera seis modelos ilustrativos, construídos por geometria procedural, com
texturas também procedurais. Não há nenhum arquivo de terceiros envolvido:
todo o conteúdo é original deste projeto.

ESCALA: glTF usa METROS como unidade. Cada modelo é escalado para que a sua
caixa delimitadora (bounding box) seja EXATAMENTE igual às dimensões
cadastradas no cardápio:
    eixo X = largura, eixo Z = profundidade, eixo Y = altura (Y para cima).
Assim, com ar-scale="fixed" no <model-viewer>, o objeto aparece em AR no
tamanho declarado (ex.: 0,03 m = 3 cm para o brigadeiro).

IMPORTANTE: as formas são aproximações artísticas e as medidas são
demonstrativas. Não representam com precisão nenhum alimento real.

Uso:
    pip install numpy pillow
    python3 tools/gerar_modelos.py            # grava em public/assets/models/
    python3 tools/gerar_modelos.py --saida pasta/
"""
import argparse
import io
import json
import math
import os
import struct

import numpy as np
from PIL import Image, ImageFilter

TAU = 2 * math.pi

# ---------------------------------------------------------------------------
# Dimensões-alvo em centímetros: (largura X, profundidade Z, altura Y)
# ---------------------------------------------------------------------------
PRODUTOS = {
    "coxinha":       (5.0, 5.0, 9.0),   # 9 × 5 × 5 cm, modelada em pé (altura 9 cm)
    "pao-de-queijo": (5.0, 5.0, 4.0),
    "pastel":        (12.0, 8.0, 3.0),
    "croissant":     (12.0, 7.0, 5.0),
    "empada":        (8.0, 8.0, 4.0),
    "brigadeiro":    (3.0, 3.0, 3.0),
}


# ---------------------------------------------------------------------------
# Ruído e texturas
# ---------------------------------------------------------------------------
def fbm(w, h, seed, base=8, octaves=5, persist=0.55):
    """Ruído fractal em [0,1], periódico na horizontal (sem costura na textura)."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gw = base * 2 ** o
        gh = max(2, int(round(gw * h / w)))
        if gw > w:
            break
        g = r.random((gh, gw)).astype(np.float32)
        g = np.concatenate([g[:, -2:], g, g[:, :2]], axis=1)
        sw = w * (gw + 4) // gw
        img = Image.fromarray(g, "F").resize((sw, h), Image.BICUBIC)
        a = np.asarray(img)
        off = 2 * w // gw
        out += amp * a[:, off:off + w]
        total += amp
        amp *= persist
    out /= total
    out = (out - out.min()) / (out.max() - out.min() + 1e-9)
    return out


def mix(c1, c2, t):
    c1 = np.asarray(c1, np.float32)
    c2 = np.asarray(c2, np.float32)
    t = np.clip(t, 0, 1)[..., None]
    return c1 * (1 - t) + c2 * t


def hexrgb(s):
    s = s.lstrip("#")
    return [int(s[i:i + 2], 16) for i in (0, 2, 4)]


def to_jpeg(arr):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True)
    return buf.getvalue()


S = 512  # resolução das texturas
V = np.linspace(0, 1, S)[:, None] * np.ones((1, S))  # v (0 = topo da imagem)
U = np.ones((S, 1)) * np.linspace(0, 1, S, endpoint=False)[None, :]


def tex_coxinha():
    n1 = fbm(S, S, 11, base=16, octaves=5)
    crumbs = fbm(S, S, 12, base=128, octaves=2)
    c = mix(hexrgb("#D99A45"), hexrgb("#A9621F"), n1 * 0.9)
    c = mix(c, hexrgb("#F0C27A"), (crumbs > 0.72) * 0.8)
    c = mix(c, hexrgb("#7E4512"), (crumbs < 0.18) * 0.6)
    # base (v próximo de 0 → parte de baixo) um pouco mais escura
    c = mix(c, hexrgb("#8E5418"), (1 - V) ** 6 * 0.0 + V ** 8 * 0.5)
    return c


def tex_pao_de_queijo():
    n1 = fbm(S, S, 21, base=8, octaves=5)
    n2 = fbm(S, S, 22, base=32, octaves=3)
    top = (1 - V)  # topo do pão
    c = mix(hexrgb("#F2D9A0"), hexrgb("#E3B865"), n1)
    c = mix(c, hexrgb("#C8893A"), np.clip(top - 0.45, 0, 1) * 1.5 * (0.5 + n2))
    cracks = np.abs(n2 - 0.5) < 0.012
    c = mix(c, hexrgb("#F8E6B8"), cracks * 0.35)
    return c


def tex_pastel():
    n1 = fbm(S, S, 31, base=8, octaves=5)
    n2 = fbm(S, S, 32, base=64, octaves=3)
    c = mix(hexrgb("#E8B159"), hexrgb("#C47F2C"), n1)
    # v = 1 → borda curva; escurece nas bordas
    c = mix(c, hexrgb("#9B5A1C"), np.clip((V - 0.82) / 0.18, 0, 1) * 0.75)
    # bolhas de massa
    c = mix(c, hexrgb("#F7D58E"), (n2 > 0.78) * 0.55)
    # marcas de garfo perto da borda curva
    fork = (np.abs(np.sin(U * TAU * 40)) > 0.88) & (V > 0.86) & (V < 0.97)
    c = mix(c, hexrgb("#7A4313"), fork * 0.75)
    return c


def tex_croissant():
    n1 = fbm(S, S, 41, base=8, octaves=5)
    n2 = fbm(S, S, 42, base=64, octaves=3)
    # u percorre o arco (de ponta a ponta); v contorna a seção
    layers = 0.5 + 0.5 * np.cos(U * TAU * 9)
    c = mix(hexrgb("#B86A22"), hexrgb("#E8A85A"), layers ** 3 * 0.85)
    c = mix(c, hexrgb("#8C4A14"), n1 * 0.45)
    c = mix(c, hexrgb("#F6D7A3"), (n2 > 0.8) * 0.4)
    # parte de baixo mais clara
    under = np.clip(np.cos((V - 0.75) * TAU) * 1.2 - 0.3, 0, 1)
    c = mix(c, hexrgb("#E9C38A"), under * 0.6)
    return c


def tex_empada():
    n1 = fbm(S, S, 51, base=8, octaves=5)
    n2 = fbm(S, S, 52, base=32, octaves=3)
    c = mix(hexrgb("#F0D49A"), hexrgb("#DDAA5C"), n1)
    lid = 1 - V  # v pequeno = centro da tampa (topo)
    c = mix(c, hexrgb("#C07E30"), np.clip(lid - 0.55, 0, 1) * 1.6 * (0.6 + 0.6 * n2))
    return c


def tex_brigadeiro():
    n1 = fbm(S, S, 61, base=16, octaves=5)
    return mix(hexrgb("#4A2C1A"), hexrgb("#2E1A0E"), n1)


def tex_granulado():
    n1 = fbm(S // 4, S // 4, 71, base=8, octaves=3)
    return mix(hexrgb("#3A2212"), hexrgb("#1E110A"), n1)


# ---------------------------------------------------------------------------
# Geometria
# ---------------------------------------------------------------------------
class Parte:
    def __init__(self, pos, uv, idx, material):
        self.pos = pos.astype(np.float64)
        self.uv = uv.astype(np.float32)
        self.idx = idx.astype(np.uint32)
        self.material = material
        self.nrm = None


def grade(P):
    """P: (nv, nu, 3) → posições, uv e triângulos de uma superfície em grade."""
    nv, nu, _ = P.shape
    pos = P.reshape(-1, 3)
    uu, vv = np.meshgrid(np.linspace(0, 1, nu), np.linspace(0, 1, nv))
    uv = np.stack([uu.ravel(), vv.ravel()], 1)
    ids = np.arange(nv * nu).reshape(nv, nu)
    a = ids[:-1, :-1].ravel()
    b = ids[:-1, 1:].ravel()
    c = ids[1:, 1:].ravel()
    d = ids[1:, :-1].ravel()
    tri = np.concatenate([np.stack([a, c, b], 1), np.stack([a, d, c], 1)])
    return pos, uv, tri


def normais(partes):
    """Normais suaves, soldadas por posição (sem costuras nem artefatos nos polos)."""
    allpos = np.concatenate([p.pos for p in partes])
    off = np.cumsum([0] + [len(p.pos) for p in partes])
    acc = np.zeros_like(allpos)
    for k, p in enumerate(partes):
        t = p.idx.astype(np.int64)
        v0, v1, v2 = p.pos[t[:, 0]], p.pos[t[:, 1]], p.pos[t[:, 2]]
        fn = np.cross(v1 - v0, v2 - v0)
        for j in range(3):
            np.add.at(acc, t[:, j] + off[k], fn)
    # soldar por posição dentro de cada parte (partes diferentes mantêm aresta viva)
    for k, p in enumerate(partes):
        sl = slice(off[k], off[k + 1])
        key = np.round(allpos[sl] / 1e-6).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.ravel()
        s = np.zeros((inv.max() + 1, 3))
        np.add.at(s, inv, acc[sl])
        acc[sl] = s[inv]
    ln = np.linalg.norm(acc, axis=1, keepdims=True)
    ln[ln == 0] = 1
    acc /= ln
    for k, p in enumerate(partes):
        p.nrm = acc[off[k]:off[k + 1]]


def torno(raio, altura, nt=96, nu=128, mod=None, uv_v=None):
    """Superfície de revolução em torno de Y. raio/altura: funções de t∈[0,1]."""
    t = np.linspace(0, 1, nt)[:, None]
    th = np.linspace(0, TAU, nu + 1)[None, :]
    r = raio(t) * (mod(th, t) if mod else 1.0)
    y = altura(t) * np.ones_like(th)
    P = np.stack([r * np.cos(th), y, -r * np.sin(th)], -1)
    return P


def ruido_ang(seed, amp, kmin=3, kmax=9, n=10):
    """Perturbação suave periódica em θ e t (deformação orgânica)."""
    r = np.random.default_rng(seed)
    termos = [(r.integers(kmin, kmax), r.uniform(1, 6), r.uniform(0, TAU), r.uniform(0, TAU),
               r.uniform(0.3, 1)) for _ in range(n)]
    tot = sum(t[4] for t in termos)

    def f(th, t):
        s = 0
        for k, ft, a, b, w in termos:
            s = s + w * np.sin(k * th + a) * np.sin(ft * math.pi * t + b)
        return 1 + amp * s / tot
    return f


def escalar(partes, alvo_cm):
    """Escala não uniforme para que a caixa delimitadora = dimensões-alvo (em metros)."""
    allpos = np.concatenate([p.pos for p in partes])
    mn, mx = allpos.min(0), allpos.max(0)
    tam = mx - mn
    L, Pf, A = alvo_cm
    alvo = np.array([L, A, Pf]) / 100.0  # X, Y, Z em metros
    s = alvo / tam
    centro = np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])
    for p in partes:
        p.pos = (p.pos - centro) * s
        n = p.nrm / s  # transformação correta de normais (inversa transposta)
        p.nrm = n / np.linalg.norm(n, axis=1, keepdims=True)


# ------------------------------- produtos ---------------------------------
def modelo_coxinha():
    def raio(t):
        base = np.sin(math.pi * np.clip(t, 0, 1)) ** 0.5
        return base * (1 - 0.55 * t ** 1.4) * (1 - t) ** 0.25

    P = torno(raio, lambda t: t, nt=80, nu=96, mod=ruido_ang(1, 0.035))
    # biquinho levemente torto
    t = np.linspace(0, 1, P.shape[0])[:, None]
    P[..., 0] += 0.04 * np.clip(t - 0.75, 0, 1) ** 2 * 6
    pos, uv, tri = grade(P)
    return [Parte(pos, uv, tri, "massa")], {
        "massa": dict(tex=tex_coxinha(), rough=0.88)}


def modelo_pao_de_queijo():
    def raio(t):
        return np.sin(math.pi * t) ** 0.8

    def altura(t):
        y = -np.cos(math.pi * t)
        return np.where(y < -0.55, -0.55 - (y + 0.55) * 0.12, y)  # base achatada

    P = torno(raio, altura, nt=72, nu=96, mod=ruido_ang(2, 0.07, 2, 6, 14))
    pos, uv, tri = grade(P[::-1].copy())  # inverte p/ v=0 no topo da textura
    tri = tri[:, [0, 2, 1]]
    return [Parte(pos, uv, tri, "massa")], {
        "massa": dict(tex=tex_pao_de_queijo(), rough=0.92)}


def modelo_pastel():
    nu, nv = 96, 56
    u = np.linspace(-1, 1, nu)[None, :]
    v = np.linspace(0, 1, nv)[:, None]
    x = u * np.ones_like(v)
    zmax = np.sqrt(np.clip(1 - u ** 2, 0, 1))
    z = v * zmax
    # perfil de travesseiro: espessura zero em toda a borda
    rr = np.clip(4 * v * (1 - v), 0, 1) ** 0.42 * np.clip(1 - u ** 2, 0, 1) ** 0.42
    ond = 1 + 0.06 * np.sin(u * 23) * np.sin(v * 7)
    top = rr * ond
    bot = -0.55 * rr
    Pt = np.stack([x, top, z], -1)
    Pb = np.stack([x, bot, z], -1)
    p1, uv1, t1 = grade(Pt)
    p2, uv2, t2 = grade(Pb)
    t1 = t1[:, [0, 2, 1]]
    # borda frisada (ondulação pequena no plano XZ perto da borda curva)
    for p in (p1, p2):
        ang = np.arctan2(p[:, 2], p[:, 0])
        rad = np.hypot(p[:, 0], p[:, 2])
        f = 1 + 0.012 * np.sin(ang * 46) * (rad > 0.9)
        p[:, 0] *= f
        p[:, 2] *= f
    return [Parte(p1, uv1, t1, "massa"), Parte(p2, uv2, t2, "massa")], {
        "massa": dict(tex=tex_pastel(), rough=0.5)}


def modelo_croissant():
    nu, nv = 128, 48
    s = np.linspace(0, 1, nu)[None, :]           # ao longo do arco
    phi = np.linspace(0, TAU, nv)[:, None]       # em volta da seção
    # espinha: arco de circunferência no plano XZ
    a0, a1 = math.radians(205), math.radians(-25)
    ang = a0 + (a1 - a0) * s
    R = 1.0
    cx, cz = R * np.cos(ang), R * np.sin(ang)
    tx, tz = -np.sin(ang), np.cos(ang)  # tangente
    nx, nz = np.cos(ang), np.sin(ang)   # normal (radial)
    # raio da seção: grosso no meio, afinando nas pontas, com gomos
    env = np.sin(math.pi * s) ** 0.85
    gomos = 1 + 0.16 * np.cos(s * TAU * 3.5) ** 2 - 0.08
    rad = 0.6 * env * gomos
    ry = rad * 0.92
    px = cx + nx * rad * np.cos(phi)
    pz = cz + nz * rad * np.cos(phi)
    py = ry * np.sin(phi)
    py = np.where(py < -0.6 * ry, -0.6 * ry + (py + 0.6 * ry) * 0.2, py)  # base apoiada
    P = np.stack([px, py, pz], -1)
    pos, uv, tri = grade(P)
    return [Parte(pos, uv, tri, "massa")], {
        "massa": dict(tex=tex_croissant(), rough=0.42)}


def modelo_empada():
    # perfil (r, y) do copinho + tampa, de dentro do topo até o centro da base
    pts = [
        (0.00, 1.00), (0.25, 0.99), (0.50, 0.96), (0.72, 0.90), (0.86, 0.84),
        (0.95, 0.80), (1.00, 0.76), (0.99, 0.70), (0.93, 0.66),  # aba/borda
        (0.92, 0.55), (0.89, 0.30), (0.86, 0.08), (0.82, 0.01),
        (0.70, 0.00), (0.35, 0.00), (0.00, 0.00),
    ]
    pts = np.array(pts)
    # reamostrar suavemente pelo comprimento de arco
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    tt = np.linspace(0, seg[-1], 90)
    r = np.interp(tt, seg, pts[:, 0])
    y = np.interp(tt, seg, pts[:, 1])
    nt = len(tt)
    th = np.linspace(0, TAU, 145)[None, :]
    # babado na borda (θ) só na região da aba
    borda = np.exp(-((tt - seg[6]) / (0.08 * seg[-1])) ** 2)[:, None]
    mod = 1 + 0.035 * np.cos(th * 18) * borda
    rr = r[:, None] * mod
    yy = y[:, None] + 0.025 * np.cos(th * 18) * borda
    P = np.stack([rr * np.cos(th), yy * np.ones_like(th), -rr * np.sin(th)], -1)
    pos, uv, tri = grade(P)
    tri = tri[:, [0, 2, 1]]
    return [Parte(pos, uv, tri, "massa")], {
        "massa": dict(tex=tex_empada(), rough=0.82)}


def modelo_brigadeiro():
    def raio(t):
        return np.sin(math.pi * t)

    def altura(t):
        y = -np.cos(math.pi * t)
        return np.where(y < -0.7, -0.7 - (y + 0.7) * 0.15, y)

    P = torno(raio, altura, nt=48, nu=72, mod=ruido_ang(3, 0.025))
    pos, uv, tri = grade(P[::-1].copy())
    tri = tri[:, [0, 2, 1]]
    partes = [Parte(pos, uv, tri, "chocolate")]
    # granulado: pequenos bastões sobre a superfície
    r = np.random.default_rng(7)
    gp, gt = [], []
    base = 0
    nseg, ln, rad = 5, 0.13, 0.03
    for _ in range(260):
        while True:
            d = r.normal(size=3)
            d /= np.linalg.norm(d)
            if d[1] > -0.55:
                break
        c = d * 1.0
        tang = np.cross(d, r.normal(size=3))
        tang /= np.linalg.norm(tang)
        bit = np.cross(d, tang)
        ring = []
        for e in (-0.5, 0.5):
            for k in range(nseg):
                a = TAU * k / nseg
                ring.append(c + d * rad * 0.6 + tang * ln * e
                            + (d * np.cos(a) + bit * np.sin(a)) * rad)
        ring.append(c + d * rad * 0.6 - tang * ln * 0.55)
        ring.append(c + d * rad * 0.6 + tang * ln * 0.55)
        gp.extend(ring)
        A, B = 2 * nseg, 2 * nseg + 1
        for k in range(nseg):
            k1 = (k + 1) % nseg
            gt += [(base + k, base + nseg + k, base + nseg + k1),
                   (base + k, base + nseg + k1, base + k1),
                   (base + A, base + k1, base + k),
                   (base + B, base + nseg + k, base + nseg + k1)]
        base += len(ring)
    gp = np.array(gp)
    gt = np.array(gt)
    guv = np.zeros((len(gp), 2))
    partes.append(Parte(gp, guv, gt, "granulado"))
    return partes, {
        "chocolate": dict(tex=tex_brigadeiro(), rough=0.62),
        "granulado": dict(tex=tex_granulado(), rough=0.5),
    }


MODELOS = {
    "coxinha": modelo_coxinha,
    "pao-de-queijo": modelo_pao_de_queijo,
    "pastel": modelo_pastel,
    "croissant": modelo_croissant,
    "empada": modelo_empada,
    "brigadeiro": modelo_brigadeiro,
}


# ---------------------------------------------------------------------------
# Escrita GLB (glTF 2.0 binário), sem dependências externas
# ---------------------------------------------------------------------------
def escrever_glb(caminho, nome, partes, materiais, alvo_cm):
    bin_ = bytearray()
    views, accs = [], []

    def add_view(data, target=None):
        while len(bin_) % 4:
            bin_.append(0)
        off = len(bin_)
        bin_.extend(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1

    def add_acc(arr, tipo, comp, target, minmax=False):
        vi = add_view(arr.tobytes(), target)
        a = {"bufferView": vi, "componentType": comp, "count": int(arr.shape[0]), "type": tipo}
        if minmax:
            a["min"] = arr.min(0).tolist()
            a["max"] = arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1

    mat_ids, mats, images, textures = {}, [], [], []
    for mname, m in materiais.items():
        img_view = add_view(to_jpeg(m["tex"]))
        images.append({"bufferView": img_view, "mimeType": "image/jpeg", "name": f"{nome}-{mname}"})
        textures.append({"sampler": 0, "source": len(images) - 1})
        mats.append({
            "name": mname,
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": len(textures) - 1},
                "metallicFactor": 0.0,
                "roughnessFactor": m["rough"],
            },
        })
        mat_ids[mname] = len(mats) - 1

    prims = []
    for p in partes:
        pos = p.pos.astype(np.float32)
        nrm = p.nrm.astype(np.float32)
        uv = p.uv.astype(np.float32)
        idx = p.idx.astype(np.uint32).ravel()
        prims.append({
            "attributes": {
                "POSITION": add_acc(pos, "VEC3", 5126, 34962, True),
                "NORMAL": add_acc(nrm, "VEC3", 5126, 34962),
                "TEXCOORD_0": add_acc(uv, "VEC2", 5126, 34962),
            },
            "indices": add_acc(idx.reshape(-1, 1), "SCALAR", 5125, 34963),
            "material": mat_ids[p.material],
        })
    for a in accs:
        if a["type"] == "SCALAR":
            a.pop("min", None)

    L, Pf, A = alvo_cm
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "MenuReal AR gerar_modelos.py",
            "copyright": "MenuReal AR — modelo ilustrativo original (CC0 1.0)",
            "extras": {
                "unidade": "metro",
                "dimensoes_cm": {"largura_x": L, "profundidade_z": Pf, "altura_y": A},
                "aviso": "Forma aproximada e medidas demonstrativas; nao representa um alimento real medido.",
            },
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": nome}],
        "meshes": [{"name": nome, "primitives": prims}],
        "materials": mats,
        "textures": textures,
        "images": images,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 33071}],
        "accessors": accs,
        "bufferViews": views,
        "buffers": [{"byteLength": 0}],
    }
    while len(bin_) % 4:
        bin_.append(0)
    gltf["buffers"][0]["byteLength"] = len(bin_)
    js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(js) % 4:
        js += b" "
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(caminho, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942))
        f.write(bin_)


def volume_assinado(partes):
    v = 0.0
    for p in partes:
        t = p.idx.astype(np.int64)
        a, b, c = p.pos[t[:, 0]], p.pos[t[:, 1]], p.pos[t[:, 2]]
        v += np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "..", "public", "assets", "models"))
    args = ap.parse_args()
    os.makedirs(args.saida, exist_ok=True)
    for nome, fn in MODELOS.items():
        partes, mats = fn()
        normais(partes)
        escalar(partes, PRODUTOS[nome])
        centro = np.concatenate([p.pos for p in partes]).mean(0)
        for p in partes:  # garante normais e ordem dos vértices voltadas para fora
            if np.einsum("ij,ij->i", p.nrm, p.pos - centro).mean() < 0:
                p.idx = p.idx[:, [0, 2, 1]]
                p.nrm = -p.nrm
        vol = volume_assinado(partes[:1])
        allpos = np.concatenate([p.pos for p in partes])
        dim = (allpos.max(0) - allpos.min(0)) * 100
        destino = os.path.join(args.saida, f"{nome}.glb")
        escrever_glb(destino, nome, partes, mats, PRODUTOS[nome])
        ntri = sum(len(p.idx) for p in partes)
        print(f"{nome:14s} X={dim[0]:.2f} Y={dim[1]:.2f} Z={dim[2]:.2f} cm  "
              f"{ntri:6d} triângulos  {os.path.getsize(destino) / 1024:6.1f} KB  vol={'+' if vol > 0 else '-'}")


if __name__ == "__main__":
    main()
