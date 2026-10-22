#!/usr/bin/env python3
"""
MenuReal AR — açaí no copo de vidro e adicionais em 3D (ilustrativos, originais, CC0).

Gera:
  public/assets/models/acai-300.glb, acai-500.glb, acai-700.glb   copo de vidro com açaí
  public/assets/adicionais/<tipo>.glb                             coberturas

As coberturas são "normalizadas": 1 unidade = AREA × largura do copo, centradas na
origem e apoiadas na cúpula y = DOMO·(1 − (r/0.5)²), a mesma do topo do açaí. Na
montagem (public/glb.mjs), cada cobertura é escalada para a boca do copo.

Cada pedaço (fruta, cacho de granola, trecho de calda, escorrido no vidro) é um nó
separado, com dados de animação em "extras": a montagem anima a queda de cada
pedaço, a calda sendo desenhada e o escorrido descendo pelo vidro.

Uso: pip install numpy pillow && python3 tools/gerar_acai.py
"""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from gerar_modelos import (Parte, TAU, fbm, grade, hexrgb, mapa_normais, mix, normais,  # noqa: E402
                           to_jpeg)

DOMO = 0.08          # altura da cúpula / diâmetro da área coberta (igual em public/glb.mjs)
AREA = 0.88          # diâmetro da área coberta / largura do copo (igual em public/glb.mjs)
RAIZ = os.path.join(os.path.dirname(__file__), "..", "public", "assets")

# proporções do copo (frações do raio da boca): iguais nos 3 tamanhos, para as
# coberturas e o escorrido caírem no lugar certo em qualquer copo
VIDRO = 0.030        # espessura da parede
FOLGA = 0.012        # vão entre o açaí e o vidro (onde a calda escorre)
BASE = 0.075         # fundo grosso de vidro
R_ACAI = (1 - VIDRO - FOLGA) / (2 * AREA)           # borda do açaí, em unidades da cobertura
R_VIDRO = (1 - VIDRO) / (2 * AREA)                  # face interna do vidro
R_ESCORRE = (R_ACAI + R_VIDRO) / 2                  # meio do vão
INCLINACAO = 0.136   # quanto a parede entra por unidade de descida (média dos 3 copos)


def sup(x, z):
    """Altura da superfície do açaí (cúpula, sem cortar na borda)."""
    return DOMO * (1 - (np.asarray(x) ** 2 + np.asarray(z) ** 2) / 0.25)


# ---------------------------------------------------------------------------
# Utilidades de geometria
# ---------------------------------------------------------------------------
def orientar(p, centro):
    normais([p])
    if np.einsum("ij,ij->i", p.nrm, p.pos - centro).mean() < 0:
        p.idx = p.idx[:, [0, 2, 1]]
        p.nrm = -p.nrm
    return p


def juntar(pecas, material):
    pos, uv, idx, nrm, cor, base = [], [], [], [], [], 0
    com_cor = any(getattr(p, "cor", None) is not None for p in pecas)
    for p in pecas:
        pos.append(p.pos); uv.append(p.uv); nrm.append(p.nrm); idx.append(p.idx + base)
        if com_cor:
            cor.append(p.cor if getattr(p, "cor", None) is not None else np.ones((len(p.pos), 3)))
        base += len(p.pos)
    parte = Parte(np.concatenate(pos), np.concatenate(uv), np.concatenate(idx), material)
    parte.nrm = np.concatenate(nrm)
    parte.cor = np.concatenate(cor) if com_cor else None
    return parte


def rot_eixos(ax=0.0, ay=0.0, az=0.0):
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return ry @ rx @ rz


def apoio(x, z):
    """Rotação que deita a peça na inclinação da cúpula naquele ponto."""
    gx, gz = -DOMO * 2 * x / 0.25, -DOMO * 2 * z / 0.25   # derivadas da cúpula
    return rot_eixos(ax=math.atan(gz), az=-math.atan(gx))


def quat_aleatorio(r, maximo=1.6):
    eixo = r.normal(size=3)
    eixo /= np.linalg.norm(eixo)
    a = r.uniform(0.6, maximo)
    s = math.sin(a / 2)
    return [float(eixo[0] * s), float(eixo[1] * s), float(eixo[2] * s), float(math.cos(a / 2))]


def blob(centro, raios, seed, nt=9, nu=12, amp=0.25, R=None, uv=None):
    """Pedaço irregular (esfera deformada)."""
    r = np.random.default_rng(seed)
    t = np.linspace(0, 1, nt)[:, None]
    th = np.linspace(0, TAU, nu + 1)[None, :]
    k = r.uniform(0, TAU, 4)
    ruido = 1 + amp * (0.45 * np.sin(2 * th + k[0]) * np.sin(math.pi * t * 2 + k[1]) + 0.35 * np.sin(3 * th + k[2]) * np.sin(math.pi * t)
                       + 0.2 * np.sin(5 * th + k[3]) * np.sin(math.pi * t * 3))
    P = np.stack([np.sin(math.pi * t) * np.cos(th) * ruido, -np.cos(math.pi * t) * np.ones_like(th) * ruido,
                  -np.sin(math.pi * t) * np.sin(th) * ruido], -1)
    pos, u, tri = grade(P)
    pos = pos * np.asarray(raios)
    if R is not None:
        pos = pos @ R.T
    if uv is not None:
        u = np.tile(np.asarray(uv, np.float32), (len(u), 1))
    return orientar(Parte(pos + centro, u, tri, ""), np.asarray(centro, float))


def fatia(contorno, linhas, centro, R):
    """Peça com o contorno dado, empilhando anéis (escala, y, v). Bordas arredondadas."""
    c = np.vstack([contorno, contorno[:1]])
    n = len(c)
    P = np.stack([np.stack([c[:, 0] * e, np.full(n, y), c[:, 1] * e], 1) for e, y, _ in linhas])
    pos, uv, tri = grade(P)
    uv = uv.reshape(len(linhas), n, 2)
    uv[..., 1] = np.array([v for _, _, v in linhas])[:, None]
    pos = pos @ R.T + centro
    return orientar(Parte(pos, uv.reshape(-1, 2), tri, ""), np.asarray(centro, float))


def tubo_achatado(C, larg, alt, nu=12, fechar=True):
    """Fita de calda: seção elíptica larga e baixa ao longo do caminho C."""
    C = np.asarray(C, float)
    tg = np.gradient(C, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True)
    b1 = np.cross(tg, [0, 1, 0])
    vertical = np.linalg.norm(b1, axis=1) < 0.2          # caminho de pé (jato): usa outro eixo
    b1[vertical] = np.cross(tg[vertical], [1, 0, 0])
    b1 /= np.linalg.norm(b1, axis=1, keepdims=True) + 1e-9
    b2 = np.cross(b1, tg)
    b2 /= np.linalg.norm(b2, axis=1, keepdims=True) + 1e-9
    th = np.linspace(0, TAU, nu + 1)
    L = np.asarray(larg)[:, None, None]
    A = np.asarray(alt)[:, None, None]
    P = C[:, None, :] + L * np.cos(th)[None, :, None] * b1[:, None, :] + A * np.sin(th)[None, :, None] * b2[:, None, :]
    pos, uv, tri = grade(P)
    p = Parte(pos, uv, tri, "")
    normais([p])
    viz = np.repeat(C, nu + 1, axis=0)
    if np.einsum("ij,ij->i", p.nrm, pos - viz).mean() < 0:
        p.idx = p.idx[:, [0, 2, 1]]
        p.nrm = -p.nrm
    return p


def pontos_no_disco(r, n, raio_max, dist_min):
    pts, tent = [], 0
    while len(pts) < n and tent < n * 500:
        tent += 1
        a, d = r.uniform(0, TAU), raio_max * math.sqrt(r.uniform(0, 1))
        x, z = d * math.cos(a), d * math.sin(a)
        if all((x - px) ** 2 + (z - pz) ** 2 > dist_min ** 2 for px, pz in pts):
            pts.append((x, z))
    return pts


def grupo(partes, extras=None, centro=None):
    return {"partes": partes, "extras": extras or {}, "centro": centro}


# ---------------------------------------------------------------------------
# Texturas
# ---------------------------------------------------------------------------
def grade_uv(tam):
    v = np.linspace(0, 1, tam)[:, None] * np.ones((1, tam))
    u = np.ones((tam, 1)) * np.linspace(0, 1, tam, endpoint=False)[None, :]
    return u, v


def tex_ruido(c1, c2, seed, base=10, tam=256):
    return mix(hexrgb(c1), hexrgb(c2), fbm(tam, tam, seed, base=base, octaves=5))


def relevo(seed, base=24, tam=256, octaves=5):
    return fbm(tam, tam, seed, base=base, octaves=octaves)


def du(u, c):
    d = np.abs(u - c)
    return np.minimum(d, 1 - d)


V_TOPO, V_LADO = 0.42, 0.664   # faixas de v das fatias: topo | borda | fundo


def tex_banana(T=512):
    u, v = grade_uv(T)
    rho = np.where(v < V_TOPO, v / 0.5, np.where(v > V_LADO, (1 - v) / 0.4, 1.0))
    n = fbm(T, T, 81, base=10)
    fino = fbm(T, T, 82, base=48, octaves=3)
    carne = mix(hexrgb("#FFF8DE"), hexrgb("#F6E2A2"), np.clip(rho, 0, 1) ** 1.7)
    carne = mix(carne, hexrgb("#F2D98E"), n * 0.3)
    fibras = (0.5 + 0.5 * np.sin(u * TAU * 70 + fino * 6)) * np.clip((rho - 0.35) / 0.6, 0, 1)
    carne = mix(carne, hexrgb("#FBEFC4"), fibras * 0.25)
    # miolo: três gomos claros e sementinhas escuras
    gomos = (0.5 + 0.5 * np.cos(u * TAU * 3)) * np.exp(-((rho - 0.2) / 0.11) ** 2)
    carne = mix(carne, hexrgb("#E9CF86"), gomos * 0.75)
    r = np.random.default_rng(5)
    for _ in range(26):
        cu = (r.integers(0, 3) + r.normal(0, 0.1)) / 3
        cr = r.uniform(0.12, 0.3)
        d = (du(u, cu) * 7) ** 2 + ((rho - cr) * 14) ** 2
        carne = mix(carne, hexrgb("#4A2E17"), np.exp(-d * 120) * 0.95)
    borda = mix(hexrgb("#EED489"), hexrgb("#E0BE6A"), fbm(T, T, 83, base=30))
    return np.where(((v >= V_TOPO) & (v <= V_LADO))[..., None], borda, carne)


def relevo_banana(T=256):
    u, v = grade_uv(T)
    rho = np.where(v < V_TOPO, v / 0.5, np.where(v > V_LADO, (1 - v) / 0.4, 1.0))
    return 0.6 * fbm(T, T, 84, base=40) + 0.4 * (0.5 + 0.5 * np.sin(u * TAU * 70)) * np.clip(rho, 0, 1)


def tex_morango(T=512):
    u, v = grade_uv(T)
    rho = np.clip(v / 0.5, 0, 1)
    n = fbm(T, T, 91, base=12)
    raios = 0.5 + 0.5 * np.sin(u * TAU * 14 + n * 5)
    carne = mix(hexrgb("#FFF0EE"), hexrgb("#F7A1A6"), np.clip((rho - 0.15) / 0.5, 0, 1))
    carne = mix(carne, hexrgb("#FFF7F6"), raios * np.clip(1 - rho * 1.4, 0, 1) * 0.6)
    carne = mix(carne, hexrgb("#E8414D"), np.clip((rho - 0.62) / 0.25, 0, 1) * (0.75 + 0.25 * raios))
    carne = mix(carne, hexrgb("#C4182B"), np.clip((rho - 0.88) / 0.12, 0, 1))
    casca = mix(hexrgb("#D4192F"), hexrgb("#9E0E22"), fbm(T, T, 92, base=22))
    casca = mix(casca, hexrgb("#E8323F"), np.clip(fbm(T, T, 93, base=6) - 0.55, 0, 1) * 1.5)
    r = np.random.default_rng(9)
    for i in range(140):   # sementinhas em covinhas
        cu, cv = r.uniform(0, 1), r.uniform(0.52, 0.98)
        d = (du(u, cu) * 26) ** 2 + ((v - cv) * 48) ** 2
        casca = mix(casca, hexrgb("#7E0918"), np.exp(-d * 9) * 0.55)
        casca = mix(casca, hexrgb("#F2D266"), np.exp(-d * 40) * 0.95)
    return np.where((v < 0.5)[..., None], carne, casca)


def relevo_morango(T=256):
    u, v = grade_uv(T)
    h = 0.5 + 0.2 * fbm(T, T, 94, base=30)
    r = np.random.default_rng(9)
    for i in range(140):
        cu, cv = r.uniform(0, 1), r.uniform(0.52, 0.98)
        d = (du(u, cu) * 26) ** 2 + ((v - cv) * 48) ** 2
        h = h - 0.5 * np.exp(-d * 9) + 0.35 * np.exp(-d * 40)
    return np.where(v < 0.5, 0.5 + 0.25 * fbm(T, T, 95, base=60), h)


def tex_confete():
    cores = ["#D7263D", "#F4C20D", "#1B75D0", "#2DA44E", "#F57C00", "#6D3B23"]
    img = np.zeros((256, 256, 3), np.float32)
    w = 256 // len(cores)
    for i, c in enumerate(cores):
        img[:, i * w:(i + 1) * w] = hexrgb(c)
    img[:, len(cores) * w:] = hexrgb(cores[-1])
    return img


def tex_acai_parede(T=1024):
    u, v = grade_uv(T)            # v: 0 = fundo, 1 = topo
    m1 = fbm(T, T, 101, base=5, octaves=5)
    m2 = np.roll(fbm(T, T, 102, base=9, octaves=4), T // 7, axis=1)
    manchas = np.clip((m1 * 0.6 + m2 * 0.4 - 0.48) * 2.6, 0, 1)
    cor = mix(hexrgb("#14031A"), hexrgb("#2A0A31"), v)
    cor = mix(cor, hexrgb("#55215E"), manchas * 0.65)
    # bolhinhas de ar presas no vidro
    r = np.random.default_rng(103)
    for _ in range(70):
        cu, cv, rr = r.uniform(0, 1), r.uniform(0.04, 0.97), r.uniform(0.5, 1.1)
        d = (du(u, cu) * 300 / rr) ** 2 + ((v - cv) * 160 / rr) ** 2
        cor = mix(cor, hexrgb("#6E3F78"), np.exp(-d) * 0.55)
    return cor


def relevo_acai_parede(T=512):
    u, v = grade_uv(T)
    h = 0.5 + 0.3 * fbm(T, T, 104, base=12)
    r = np.random.default_rng(103)
    for _ in range(70):
        cu, cv, rr = r.uniform(0, 1), r.uniform(0.04, 0.97), r.uniform(0.5, 1.1)
        d = (du(u, cu) * 300 / rr) ** 2 + ((v - cv) * 160 / rr) ** 2
        h = h + 0.3 * np.exp(-d)
    return h


def manchas_espatula(T, seed, n=14, larg=0.05):
    """Riscos de espátula/colher (borrões alongados e inclinados) entre 0 e 1."""
    u, v = grade_uv(T)
    r = np.random.default_rng(seed)
    m = np.zeros((T, T))
    for _ in range(n):
        cu, cv = r.uniform(0, 1), r.uniform(0.05, 0.95)
        ang = r.uniform(-0.5, 0.5)
        dx, dy = du(u, cu), v - cv
        a = (dx * math.cos(ang) + dy * math.sin(ang)) / r.uniform(0.06, 0.16)
        b = (-dx * math.sin(ang) + dy * math.cos(ang)) / (larg * r.uniform(0.4, 1.0))
        m = np.maximum(m, np.exp(-(a ** 2 + b ** 2) * 2) * r.uniform(0.6, 1))
    return np.clip(m * (0.7 + 0.6 * fbm(T, T, seed + 1, base=20)), 0, 1)


def tex_acai_camada(T=1024):
    cor = tex_acai_parede(T)
    riscos = manchas_espatula(T, 121, n=18, larg=0.035)
    return mix(cor, hexrgb("#F1E7DA"), riscos * 0.9)


def tex_creme_parede(T=512):
    u, v = grade_uv(T)
    n = fbm(T, T, 131, base=8)
    cor = mix(hexrgb("#FBF5EA"), hexrgb("#EDE1CC"), n * 0.8)
    roxo = manchas_espatula(T, 132, n=9, larg=0.04)
    cor = mix(cor, hexrgb("#6A2A6F"), roxo * 0.55)
    r = np.random.default_rng(133)
    for _ in range(40):   # bolhinhas de ar no creme
        cu, cv, rr = r.uniform(0, 1), r.uniform(0, 1), r.uniform(0.5, 1.2)
        d = (du(u, cu) * 160 / rr) ** 2 + ((v - cv) * 90 / rr) ** 2
        cor = mix(cor, hexrgb("#D9CBB2"), np.exp(-d) * 0.6)
    return cor


def tex_nutella_parede(T=512):
    n = fbm(T, T, 141, base=7)
    cor = mix(hexrgb("#3A1A0C"), hexrgb("#5A2C14"), n)
    return mix(cor, hexrgb("#7A4426"), manchas_espatula(T, 142, n=10, larg=0.05) * 0.6)


def tex_acai_topo(T=1024):
    u, v = grade_uv(T)            # u: ângulo, v: centro → borda
    n1 = fbm(T, T, 111, base=6, octaves=5)
    redemoinho = 0.5 + 0.5 * np.sin(u * TAU * 5 + v * 9 + n1 * 2)
    cor = mix(hexrgb("#22052A"), hexrgb("#3E1046"), n1)
    cor = mix(cor, hexrgb("#6E3076"), np.clip(redemoinho - 0.6, 0, 1) * 2.0)
    return cor


def relevo_acai_topo(T=512):
    u, v = grade_uv(T)
    n1 = fbm(T, T, 111, base=6, octaves=5)
    return 0.65 * (0.5 + 0.5 * np.sin(u * TAU * 5 + v * 9 + n1 * 2)) + 0.35 * fbm(T, T, 113, base=28, octaves=4)


# ---------------------------------------------------------------------------
# Coberturas
# ---------------------------------------------------------------------------
QUEDA = 1.5   # de quão alto os pedaços caem (unidades da cobertura)


def peca(partes, r, atraso_max=0.55, centro=None, giro=1.6):
    return grupo(partes, {"anim": "peca", "atraso": round(float(r.uniform(0.02, atraso_max)), 3),
                          "queda": QUEDA, "giro": quat_aleatorio(r, giro)}, centro)


def rodela_banana(r, i, centro, R):
    th = np.linspace(0, TAU, 48, endpoint=False)
    R0 = 0.16 * r.uniform(0.93, 1.05)          # ~2,7 cm de diâmetro no copo de 500 ml
    T = 0.07
    cont = np.stack([R0 * np.cos(th) * (1 + 0.035 * np.sin(4 * th + i)), R0 * np.sin(th) * (1 + 0.025 * np.cos(3 * th))], 1)
    linhas = [(e, T / 2 + 0.06 * T * (1 - (e / 0.86) ** 2), e * 0.5) for e in np.linspace(0, 0.86, 8)]
    for k, f in enumerate(np.linspace(0.12, math.pi - 0.12, 9)):
        linhas.append((0.86 + 0.14 * math.sin(f), T / 2 * math.cos(f), V_TOPO + (V_LADO - V_TOPO) * (k / 8)))
    linhas += [(e, -T / 2 - 0.04 * T * (1 - (e / 0.86) ** 2), 1 - 0.4 * e) for e in np.linspace(0.86, 0, 8)]
    p = fatia(cont, linhas, centro, R)
    p.material = "banana"
    return p


MAT_BANANA = None


def mat_banana():
    global MAT_BANANA
    if MAT_BANANA is None:
        MAT_BANANA = {"banana": dict(tex=tex_banana(), rough=0.38, relevo=relevo_banana(), forca=2.5)}
    return MAT_BANANA


def camada_banana():
    r = np.random.default_rng(14)
    th = np.linspace(0, TAU, 48, endpoint=False)
    grupos = []
    lugares = [(0.29 * math.cos(a), 0.29 * math.sin(a), 0.0) for a in np.linspace(0.3, TAU + 0.3, 5, endpoint=False)]
    for i, (x, z, sobe) in enumerate(lugares):
        R0 = 0.16 * r.uniform(0.93, 1.05)          # ~2,7 cm de diâmetro no copo de 500 ml
        T = 0.07
        cont = np.stack([R0 * np.cos(th) * (1 + 0.035 * np.sin(4 * th + i)), R0 * np.sin(th) * (1 + 0.025 * np.cos(3 * th))], 1)
        linhas = [(e, T / 2 + 0.06 * T * (1 - (e / 0.86) ** 2), e * 0.5) for e in np.linspace(0, 0.86, 8)]
        for k, f in enumerate(np.linspace(0.12, math.pi - 0.12, 9)):
            linhas.append((0.86 + 0.14 * math.sin(f), T / 2 * math.cos(f), V_TOPO + (V_LADO - V_TOPO) * (k / 8)))
        linhas += [(e, -T / 2 - 0.04 * T * (1 - (e / 0.86) ** 2), 1 - 0.4 * e) for e in np.linspace(0.86, 0, 8)]
        Rr = apoio(x, z) @ rot_eixos(ax=r.uniform(-0.18, 0.18), ay=r.uniform(0, TAU), az=r.uniform(-0.18, 0.18))
        c = np.array([x, sup(x, z) + T / 2 + 0.006 + sobe, z])
        p = fatia(cont, linhas, c, Rr)
        p.material = "banana"
        grupos.append(peca([p], r, centro=c))
    return grupos, {"banana": dict(tex=tex_banana(), rough=0.38, relevo=relevo_banana(), forca=2.5)}


def contorno_morango(L, W, n=56):
    t = np.linspace(0, TAU, n, endpoint=False)
    x = W * np.sin(t) * (0.72 + 0.28 * np.cos(t)) * (1 + 0.04 * np.cos(2 * t))
    z = -L * 0.5 * np.cos(t) - L * 0.06 * np.sin(t) ** 2
    return np.stack([x, z - z.mean()], 1)


def camada_morango():
    r = np.random.default_rng(15)
    grupos = []
    # fatias no comprido
    for i, (a, d) in enumerate([(0.3 + 0.628 - 0.83, 0.3), (0.3 + 0.628 + 2.513 - 0.83, 0.3)]):
        x, z = d * math.cos(a), d * math.sin(a)
        L, W, T = 0.36, 0.3, 0.06
        cont = contorno_morango(L, W / 2)
        linhas = [(e, T / 2, e * 0.5) for e in np.linspace(0, 0.9, 7)]
        for k, f in enumerate(np.linspace(0.15, math.pi - 0.15, 7)):
            linhas.append((0.9 + 0.1 * math.sin(f), T / 2 * math.cos(f), 0.45 + 0.35 * k / 6))
        linhas += [(e, -T / 2, 1 - 0.2 * e) for e in np.linspace(0.9, 0, 5)]
        Rr = apoio(x, z) @ rot_eixos(ax=r.uniform(-0.25, 0.25), ay=a + math.pi / 2 + r.uniform(-0.3, 0.3))
        c = np.array([x, sup(x, z) + T / 2 + 0.03, z])
        p = fatia(cont, linhas, c, Rr)
        p.material = "morango"
        grupos.append(peca([p], r, centro=c))
    # metades com o corte para cima
    for i, (a, d) in enumerate([(0.3 + 0.628 + 1.257 - 0.83, 0.31), (0.0, 0.03), (0.3 + 0.628 + 3.77 - 0.83, 0.3)]):
        x, z = d * math.cos(a), d * math.sin(a)
        L, W, D = 0.34, 0.29, 0.13
        cont = contorno_morango(L, W / 2)
        linhas = [(e, 0.0, e * 0.5) for e in np.linspace(0, 0.93, 7)]
        linhas.append((1.0, -0.06 * D, 0.5))
        for k, f in enumerate(np.linspace(0, math.pi / 2, 10)[1:]):
            linhas.append((math.cos(f) * (1 - 0.1 * math.sin(f)), -0.06 * D - 0.94 * D * math.sin(f), 0.5 + 0.5 * k / 8))
        Rr = apoio(x, z) @ rot_eixos(ax=r.uniform(-0.3, 0.3), ay=r.uniform(0, TAU), az=r.uniform(-0.3, 0.3))
        c = np.array([x, sup(x, z) + D * 0.75 + 0.02, z])
        p = fatia(cont, linhas, c, Rr)
        p.material = "morango"
        grupos.append(peca([p], r, centro=c))
    return grupos, {"morango": dict(tex=tex_morango(), rough=0.26, relevo=relevo_morango(), forca=3.5)}


# ---------------------------------------------------------------------------
# Morango de verdade: um volume 3D com cor em cada ponto (miolo branco, raios rosados,
# polpa vermelha, casca com sementes em covinhas). Fatias, metades e cubinhos são cortes
# desse volume, então cada pedaço mostra o interior certo no lugar certo.
# ---------------------------------------------------------------------------
MOR_L, MOR_R = 0.40, 0.165     # comprimento e raio máximo (unidades da cobertura; ~3,4 × 2,8 cm)


def lin(hexs):
    return (np.array(hexrgb(hexs), float) / 255) ** 2.2   # glTF: cor por vértice é linear


def mor_raio(t):
    t = np.clip(t, 0, 1)
    return MOR_R * np.sqrt(np.clip(1 - (1 - t) ** 2.3, 0, 1)) * (1 - 0.28 * t ** 7)


def mor_sementes(y, phi):
    """Proximidade (0–1) da semente mais próxima na casca (grade irregular, como no morango)."""
    linha = y / MOR_L * 17
    k = np.round(linha)
    desloc = (k % 2) * (TAU / 26) + 0.35 * np.sin(k * 2.3)
    jit = 0.25 * np.sin(k * 7.1 + np.round((phi - desloc) * 13 / TAU) * 3.7)
    dphi = np.angle(np.exp(1j * (phi - desloc) * 13)) / 13
    dist = np.hypot((linha - k + jit) / 17 * MOR_L, dphi * mor_raio(y / MOR_L))
    return np.exp(-(dist / 0.0042) ** 2), np.exp(-(dist / 0.011) ** 2)


def mor_cor(P, seed=0):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    R = mor_raio(y / MOR_L) + 1e-6
    rho = np.clip(np.hypot(x, z) / R, 0, 1.2)
    phi = np.arctan2(z, x)
    r = np.random.default_rng(seed)
    ruido = 0.5 + 0.5 * np.sin(phi * 3 + y * 40 + r.uniform(0, TAU)) * np.sin(y * 23 + r.uniform(0, TAU))
    miolo, rosa, polpa, borda, casca = lin("#F8D2CF"), lin("#EC6573"), lin("#D9253A"), lin("#C3142B"), lin("#B90F27")
    t1 = np.clip((rho - 0.12) / 0.25, 0, 1)[:, None]
    cor = miolo * (1 - t1) + rosa * t1
    t2 = np.clip((rho - 0.35) / 0.3, 0, 1)[:, None]
    cor = cor * (1 - t2) + polpa * t2
    t3 = np.clip((rho - 0.82) / 0.14, 0, 1)[:, None]
    cor = cor * (1 - t3) + borda * t3
    # raios brancos que saem do miolo até as sementes
    raios = (0.5 + 0.5 * np.cos(phi * 14 + 1.5 * rho + 0.6 * ruido)) ** 10 * ((rho > 0.15) & (rho < 0.85)) * (1 - rho)
    cor = cor * (1 - 0.5 * raios[:, None]) + lin("#FBE2E0") * 0.5 * raios[:, None]
    # casca e sementes
    pele = (rho > 0.97)[:, None]
    sem, cova = mor_sementes(y, phi)
    c_casca = casca * (1 - 0.6 * cova[:, None]) + lin("#7E0A1C") * 0.6 * cova[:, None]
    c_casca = c_casca * (1 - sem[:, None]) + lin("#EACB5C") * sem[:, None]
    c_casca = c_casca * (0.9 + 0.2 * ruido[:, None])
    cor = np.where(pele, c_casca, cor)
    # topo (onde fica o cabinho, já tirado): polpa clara
    topo = np.clip((y / MOR_L - 0.96) / 0.04, 0, 1)[:, None]
    return np.clip(cor * (1 - topo) + lin("#F7D6D2") * topo, 0, 1)


def caixa_superficie(mn, mx, n):
    """Superfície de uma caixa (6 faces em grade), cada face com n[eixo] divisões."""
    faces = []
    eixos = [(0, 1, 2), (1, 2, 0), (2, 0, 1)]
    for a, b, c_ in eixos:
        for lado in (0, 1):
            ub = np.linspace(mn[b], mx[b], n[b] + 1)
            uc = np.linspace(mn[c_], mx[c_], n[c_] + 1)
            G = np.zeros((len(ub), len(uc), 3))
            G[..., a] = mx[a] if lado else mn[a]
            G[..., b] = ub[:, None]
            G[..., c_] = uc[None, :]
            faces.append(G)
    return faces


def mor_corte(mn, mx, n, R, centro, seed, relevo_cova=True):
    """Pedaço do morango dentro da caixa [mn, mx] (coordenadas do morango, eixo em Y)."""
    pos, uvs, tris, base = [], [], [], 0
    for G in caixa_superficie(np.asarray(mn, float), np.asarray(mx, float), n):
        p, uv, tri = grade(G)
        pos.append(p); uvs.append(uv); tris.append(tri + base); base += len(p)
    P = np.concatenate(pos)
    P[:, 1] = np.clip(P[:, 1], 0.004 * MOR_L, 0.996 * MOR_L)
    Rr = mor_raio(P[:, 1] / MOR_L) * 0.999
    rr = np.hypot(P[:, 0], P[:, 2]) + 1e-9
    fora = rr > Rr
    P[fora, 0] *= Rr[fora] / rr[fora]
    P[fora, 2] *= Rr[fora] / rr[fora]
    # cantos arredondados e cortes irregulares (faca, não máquina)
    r = np.random.default_rng(seed)
    meio0 = (np.asarray(mn, float) + np.asarray(mx, float)) / 2
    dlt = P - meio0
    meia = (np.asarray(mx, float) - np.asarray(mn, float)) / 2
    q = dlt / meia
    redondo = (np.max(np.abs(q), 1) / (np.linalg.norm(q, axis=1) + 1e-9)) ** (0.45 if meia.min() > 0.03 else 0.0)
    P = np.where(fora[:, None], P, meio0 + dlt * redondo[:, None])
    P += (fbm(64, 64, seed, base=4)[(np.abs(P[:, 0] * 900).astype(int)) % 64, (np.abs(P[:, 2] * 900).astype(int)) % 64][:, None] - 0.5) * 0.006 * (~fora)[:, None]
    if relevo_cova:   # covinhas das sementes na casca
        rho = np.hypot(P[:, 0], P[:, 2]) / (mor_raio(P[:, 1] / MOR_L) + 1e-9)
        _, cova = mor_sementes(P[:, 1], np.arctan2(P[:, 2], P[:, 0]))
        afunda = 0.0035 * cova * (rho > 0.97)
        P[:, 0] *= 1 - afunda / (rr + 1e-9)
        P[:, 2] *= 1 - afunda / (rr + 1e-9)
    cor = mor_cor(P, seed)
    meio = (P.min(0) + P.max(0)) / 2
    p = Parte((P - meio) @ np.asarray(R).T + centro, np.concatenate(uvs), np.concatenate(tris), "morango_real")
    p.cor = cor
    return orientar(p, np.asarray(centro, float))


MAT_MORANGO = {"morango_real": dict(cor=[1, 1, 1, 1], rough=0.3, relevo=None)}


def pedaco_morango(r, centro, R, lado=0.1, seed=0):
    """Cubinho de morango picado: uma caixa sorteada dentro do morango."""
    y0 = r.uniform(0.15, 0.85) * MOR_L
    Rm = float(mor_raio(y0 / MOR_L))
    a = r.uniform(0, TAU)
    d = r.uniform(0.25, 0.75) * Rm
    cx, cz = d * math.cos(a), d * math.sin(a)
    h = lado * r.uniform(0.8, 1.15) / 2
    mn = [cx - h, y0 - h * r.uniform(0.8, 1.2), cz - h]
    mx = [cx + h, y0 + h * r.uniform(0.8, 1.2), cz + h]
    return mor_corte(mn, mx, (9, 9, 9), R, centro, seed)


def camada_morango():
    r = np.random.default_rng(15)
    grupos = []
    deita = rot_eixos(az=math.pi / 2)    # eixo X do morango (o corte) vira para cima
    # fatias no comprido (entre as rodelas de banana: a camada é girada 0,83 rad na montagem)
    for i, (a, d) in enumerate([(0.3 + 0.628 - 0.83, 0.3), (0.3 + 0.628 + 2.513 - 0.83, 0.3)]):
        x, z = d * math.cos(a), d * math.sin(a)
        x0 = r.uniform(-0.02, 0.02)
        Rr = apoio(x, z) @ rot_eixos(ay=a + r.uniform(-0.3, 0.3)) @ deita
        c = np.array([x, sup(x, z) + 0.05, z])
        p = mor_corte([x0 - 0.032, 0, -MOR_R], [x0 + 0.032, MOR_L, MOR_R], (3, 30, 22), Rr, c, 100 + i)
        grupos.append(peca([p], r, centro=c))
    # metades com o corte para cima
    for i, (a, d) in enumerate([(0.3 + 0.628 + 1.257 - 0.83, 0.31), (0.0, 0.03), (0.3 + 0.628 + 3.77 - 0.83, 0.3)]):
        x, z = d * math.cos(a), d * math.sin(a)
        Rr = apoio(x, z) @ rot_eixos(ay=r.uniform(0, TAU), az=r.uniform(-0.25, 0.25)) @ rot_eixos(az=-math.pi / 2)
        c = np.array([x, sup(x, z) + MOR_R * 0.55 + 0.02, z])
        p = mor_corte([-0.004, 0, -MOR_R], [MOR_R, MOR_L, MOR_R], (10, 30, 22), Rr, c, 200 + i)
        grupos.append(peca([p], r, centro=c))
    return grupos, MAT_MORANGO


def camada_morango_picado():
    """Montinho de morango picado no topo (como no açaí de copo)."""
    r = np.random.default_rng(19)
    grupos = []
    pts = pontos_no_disco(r, 30, 0.44, 0.085)
    for i, (x, z) in enumerate(pts):
        monte = 0.07 * max(0.0, 1 - (x * x + z * z) / 0.2)       # mais alto no meio
        c = np.array([x, sup(x, z) + 0.05 + monte, z])
        p = pedaco_morango(r, c, rot_eixos(*r.uniform(0, TAU, 3)), lado=r.uniform(0.09, 0.115), seed=300 + i)
        grupos.append(peca([p], r, centro=c, giro=2.2))
    return grupos, MAT_MORANGO


def pedacos_morango_biblioteca():
    """Cubinhos avulsos (centrados na origem) que a montagem espalha nas camadas do copo."""
    r = np.random.default_rng(23)
    return [grupo([pedaco_morango(r, np.zeros(3), rot_eixos(*r.uniform(0, TAU, 3)), lado=r.uniform(0.09, 0.12), seed=500 + i)],
                  {"peca_biblioteca": i}, np.zeros(3)) for i in range(10)], MAT_MORANGO


def biblioteca_banana():
    r = np.random.default_rng(31)
    # "encostar": o eixo Y local (a face da rodela) fica virado para o copo
    return [grupo([rodela_banana(r, i, np.zeros(3), rot_eixos(ay=r.uniform(0, TAU)))], {"encostar": "y"}, np.zeros(3)) for i in range(6)], mat_banana()


def biblioteca_granola():
    grupos, mats = camada_granola()
    for g in grupos[:10]:
        g["extras"] = {}
    return grupos[:10], mats


def biblioteca_pacoca():
    grupos, mats = camada_pacoca()
    for g in grupos[:8]:
        g["extras"] = {}
    return grupos[:8], mats


def biblioteca_confete():
    grupos, mats = camada_confete()
    for g in grupos[:6]:
        g["extras"] = {"encostar": "y"}
    return grupos[:6], mats


def camada_granola():
    r = np.random.default_rng(11)
    grupos = []
    th = np.linspace(0, TAU, 16, endpoint=False)
    for i, (x, z) in enumerate(pontos_no_disco(r, 46, 0.47, 0.085)):
        c = np.array([x, sup(x, z) + 0.03, z])
        partes = []
        tipo = r.uniform()
        if tipo < 0.62:      # cacho: 3 a 5 grãos grudados
            pec = []
            for k in range(r.integers(3, 6)):
                o = np.array([r.normal(0, 0.028), r.normal(0, 0.01), r.normal(0, 0.028)])
                rx = r.uniform(0.024, 0.038)
                pec.append(blob(c + o, (rx, rx * r.uniform(0.55, 0.8), rx * r.uniform(0.8, 1.2)), 2000 + i * 10 + k, amp=0.35,
                                R=rot_eixos(*r.uniform(0, TAU, 3))))
            partes.append(juntar(pec, "granola"))
        elif tipo < 0.9:     # flocos de aveia
            pec = []
            for k in range(r.integers(1, 3)):
                R0 = r.uniform(0.028, 0.04)
                cont = np.stack([R0 * np.cos(th) * (1 + 0.15 * np.sin(3 * th + i + k)), R0 * 0.78 * np.sin(th)], 1)
                linhas = [(e, 0.004 + 0.003 * (1 - e), e * 0.5) for e in np.linspace(0, 1, 4)] + [(e, -0.004, 1 - 0.5 * e) for e in np.linspace(1, 0, 3)]
                o = np.array([r.normal(0, 0.03), 0.004 * k, r.normal(0, 0.03)])
                pec.append(fatia(cont, linhas, c + o, apoio(x, z) @ rot_eixos(*r.uniform(-0.6, 0.6, 3))))
            partes.append(juntar(pec, "aveia"))
        else:                # passas
            rx = r.uniform(0.02, 0.028)
            partes.append(juntar([blob(c, (rx, rx * 0.6, rx * 1.35), 3000 + i, amp=0.4, R=rot_eixos(ay=r.uniform(0, TAU)))], "passas"))
        grupos.append(peca(partes, r, centro=c))
    return grupos, {
        "granola": dict(tex=tex_ruido("#CF9443", "#7A4515", 12, 18), rough=0.74, relevo=relevo(14, 46), forca=7),
        "aveia": dict(tex=tex_ruido("#EEDDB6", "#CBAE7C", 15, 30), rough=0.82, relevo=relevo(16, 60), forca=4),
        "passas": dict(tex=tex_ruido("#40201B", "#1D0D0A", 17, 20), rough=0.35, relevo=relevo(18, 26), forca=8),
    }


def camada_pacoca():
    r = np.random.default_rng(12)
    grupos = []
    for i, (x, z) in enumerate(pontos_no_disco(r, 40, 0.47, 0.075)):
        c = np.array([x, sup(x, z) + 0.025, z])
        pec = []
        for k in range(r.integers(2, 5)):
            o = np.array([r.normal(0, 0.03), r.normal(0, 0.008), r.normal(0, 0.03)])
            rx = r.uniform(0.016, 0.034)
            pec.append(blob(c + o, (rx, rx * 0.7, rx * 1.1), 4000 + i * 10 + k, nt=6, nu=7, amp=0.3, R=rot_eixos(*r.uniform(0, TAU, 3))))
        grupos.append(peca([juntar(pec, "pacoca")], r, centro=c))
    return grupos, {"pacoca": dict(tex=tex_ruido("#E2BC86", "#B0813F", 13, 40), rough=0.93, relevo=relevo(19, 70), forca=8)}


def camada_confete():
    r = np.random.default_rng(13)
    grupos = []
    for i, (x, z) in enumerate(pontos_no_disco(r, 22, 0.46, 0.12)):
        c = np.array([x, sup(x, z) + 0.026, z])
        cor = (i % 6 + 0.5) / 6
        p = blob(c, (0.058, 0.024, 0.058), 600 + i, nt=12, nu=20, amp=0.0, R=apoio(x, z) @ rot_eixos(ax=r.uniform(-0.3, 0.3), az=r.uniform(-0.3, 0.3)), uv=(cor, 0.5))
        p.material = "confete"
        grupos.append(peca([p], r, centro=c, giro=2.5))
    return grupos, {"confete": dict(tex=tex_confete(), rough=0.14)}


def camada_leite_po():
    r = np.random.default_rng(16)
    grupos = []
    cx, cz = 0.1, -0.08
    c = np.array([cx, sup(cx, cz) - 0.01, cz])
    monte = blob(c, (0.21, 0.08, 0.19), 900, nt=18, nu=28, amp=0.14)
    monte.material = "leite_po"
    grupos.append(grupo([monte], {"anim": "monte", "atraso": 0.05}, np.array([cx, sup(cx, cz) - 0.05, cz])))
    for i, (x, z) in enumerate(pontos_no_disco(r, 26, 0.45, 0.06)):
        cc = np.array([x, sup(x, z) + 0.005, z])
        rx = r.uniform(0.014, 0.026)
        p = blob(cc, (rx, rx * 0.45, rx), 950 + i, nt=6, nu=7, amp=0.15)
        p.material = "leite_po"
        grupos.append(peca([p], r, atraso_max=0.6, centro=cc))
    return grupos, {"leite_po": dict(tex=tex_ruido("#FFFEF9", "#EFE9DC", 17, 26), rough=1.0, relevo=relevo(22, 90), forca=6)}


# --- caldas: fita sobre o açaí que escorre pelo vidro -----------------------
def catmull(P, n=40):
    P = np.asarray(P, float)
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return np.array(out)


def camada_calda(material, rot, seed, larg=0.026, alt=0.009, escorre=(1, 3, 4, 6)):
    r = np.random.default_rng(seed)
    angs = [150, 30, 172, 8, 196, -16, 222, -42]     # zigue-zague de uma borda à outra
    borda = R_ACAI - 0.012
    ctrl = [np.array([borda * math.cos(math.radians(a) + rot), borda * math.sin(math.radians(a) + rot)]) for a in angs]
    C2 = catmull(ctrl, 46)
    s = np.linspace(0, 1, len(C2))
    C = np.stack([C2[:, 0], sup(C2[:, 0], C2[:, 1]) + alt * 0.7, C2[:, 1]], 1)
    w = larg * (1 + 0.22 * np.sin(s * 37 + seed) + 0.12 * np.sin(s * 91 + 2 * seed))
    h = alt * (1 + 0.15 * np.sin(s * 53 + seed))
    fim = np.clip(np.minimum(s, 1 - s) / 0.012, 0, 1) ** 0.5
    w, h = w * (0.25 + 0.75 * fim), h * (0.25 + 0.75 * fim)
    grupos = []
    nseg = 16
    cortes = np.linspace(0, len(C) - 1, nseg + 1).astype(int)
    for k in range(nseg):
        a, b = max(cortes[k] - 2, 0), min(cortes[k + 1] + 3, len(C))
        p = tubo_achatado(C[a:b], w[a:b], h[a:b])
        p.material = material
        p.uv[:] = 0.5
        ex = {"anim": "calda", "atraso": round(0.04 + 0.85 * (k + 1) / nseg, 3)}
        if k == 0:  # caminho do bico do frasco: [tempo, x, y, z] ao longo da calda
            idx = np.linspace(0, len(C) - 1, 64).astype(int)
            ex["caminho"] = [[round(0.04 + 0.85 * i / (len(C) - 1), 3)] + [round(float(v), 4) for v in C[i]] for i in idx]
        grupos.append(grupo([p], ex))
    # escorridos pelo vidro nas pontas do zigue-zague
    for j in escorre:
        a = math.atan2(ctrl[j][1], ctrl[j][0])
        i_ctrl = int(round(j * (len(C) - 1) / (len(ctrl) - 1)))
        atraso = 0.04 + 0.85 * i_ctrl / (len(C) - 1) + 0.05
        comp = r.uniform(0.16, 0.3)
        n = 40
        t = np.linspace(0, 1, n)
        prof = comp * t
        rad = R_ESCORRE - INCLINACAO * prof
        desvio = 0.012 * np.sin(t * 5 + j) * t
        ang = a + desvio / R_ESCORRE
        topo_y = float(sup(R_ACAI, 0)) - 0.002
        P = np.stack([rad * np.cos(ang), topo_y - prof, rad * np.sin(ang)], 1)
        larg_e = larg * 0.95 * (1 - 0.35 * t) * (1 + 0.7 * np.exp(-((t - 0.9) / 0.07) ** 2))
        larg_e *= np.clip((1 - t) / 0.05, 0, 1) ** 0.5
        esp = 0.0022 * np.ones(n) * np.clip((1 - t) / 0.05, 0.15, 1)
        # seção achatada contra o vidro: larga na tangente, fina no raio
        tg = np.stack([-np.sin(ang), np.zeros(n), np.cos(ang)], 1)
        radial = np.stack([np.cos(ang), np.zeros(n), np.sin(ang)], 1)
        th = np.linspace(0, TAU, 13)
        Q = P[:, None, :] + larg_e[:, None, None] * np.cos(th)[None, :, None] * tg[:, None, :] + esp[:, None, None] * np.sin(th)[None, :, None] * radial[:, None, :]
        pos, uv, tri = grade(Q)
        pe = Parte(pos, uv, tri, material)
        normais([pe])
        if np.einsum("ij,ij->i", pe.nrm, pos - np.repeat(P, 13, axis=0)).mean() < 0:
            pe.idx = pe.idx[:, [0, 2, 1]]; pe.nrm = -pe.nrm
        pe.uv[:] = 0.5
        # ponte da fita até a borda do vidro
        ponte = tubo_achatado(np.stack([np.linspace(borda, R_ESCORRE, 8) * math.cos(a), np.linspace(float(sup(borda, 0)) + alt * 0.7, topo_y, 8),
                                        np.linspace(borda, R_ESCORRE, 8) * math.sin(a)], 1), np.full(8, larg), np.full(8, alt))
        ponte.material = material
        ponte.uv[:] = 0.5
        grupos.append(grupo([ponte], {"anim": "calda", "atraso": round(atraso - 0.04, 3)}))
        grupos.append(grupo([pe], {"anim": "escorrido", "atraso": round(atraso, 3)}, centro=P[0]))
    return grupos


def camada_nutella():
    """Colherada de Nutella no meio: monte brilhante e achatado, com o redemoinho da colher."""
    nt, nu = 40, 120
    t = np.linspace(0, 1, nt)[:, None]
    th = np.linspace(0, TAU, nu + 1)[None, :]
    R0 = 0.27 * (1 + 0.06 * np.sin(3 * th + 0.7) + 0.04 * np.sin(5 * th + 2.1))
    rr = R0 * t
    h = 0.21 * (1 - t ** 2) ** 0.7
    sulco = 0.022 * np.sin(th * 1 - t * 14) * np.sin(math.pi * t) ** 1.5        # redemoinho da colher
    pico = 0.03 * np.exp(-((t - 0.05) / 0.08) ** 2)
    y = h + sulco + pico
    xs, zs = rr * np.cos(th), rr * np.sin(th)
    P = np.stack([xs, sup(xs, zs) + 0.004 + y, -zs], -1)
    pos, uv, tri = grade(P)
    p = Parte(pos, uv, tri, "nutella")
    normais([p])
    if p.nrm[:, 1].mean() < 0:
        p.idx = p.idx[:, [0, 2, 1]]; p.nrm = -p.nrm
    base_y = float(sup(0, 0))
    ex = {"anim": "monte", "atraso": 0.1}
    # caminho do bico da bisnaga: espiral de fora para dentro sobre o monte
    tc = np.linspace(0, 1, 48)
    rc = 0.2 * (1 - tc)
    ex["caminho"] = [[round(0.04 + 0.85 * float(a), 3), round(float(r_ * math.cos(a * 2.2 * TAU)), 4), round(base_y + 0.13, 4),
                      round(float(r_ * math.sin(a * 2.2 * TAU)), 4)] for a, r_ in zip(tc, rc)]
    return [grupo([p], ex, np.array([0.0, base_y, 0.0]))], {"nutella": dict(cor=[0.11, 0.045, 0.02, 1], rough=0.16, relevo=relevo(33, 14), forca=1.5)}


def camada_leite_condensado():
    return camada_calda("leite_condensado", 0.35, 1), {
        "leite_condensado": dict(cor=[0.95, 0.9, 0.78, 1], rough=0.1, relevo=relevo(31, 18), forca=1.5)}


def camada_calda_chocolate():
    return camada_calda("calda_chocolate", math.pi / 2 + 0.25, 2, larg=0.024, escorre=(0, 2, 5, 7)), {
        "calda_chocolate": dict(cor=[0.13, 0.055, 0.025, 1], rough=0.07, relevo=relevo(32, 18), forca=1.5)}


CAMADAS = {
    "granola": camada_granola,
    "pacoca": camada_pacoca,
    "confete": camada_confete,
    "banana": camada_banana,
    "morango": camada_morango,
    "leite_po": camada_leite_po,
    "leite_condensado": camada_leite_condensado,
    "calda_chocolate": camada_calda_chocolate,
    "morango_picado": camada_morango_picado,
    "nutella": camada_nutella,
}


# ---------------------------------------------------------------------------
# Copo de vidro com açaí (metros)
# ---------------------------------------------------------------------------
COPOS = {  # raio da boca, raio do fundo, altura (cm)
    "acai-300": (4.3, 3.0, 9.0),
    "acai-500": (4.8, 3.3, 11.0),
    "acai-700": (5.3, 3.6, 12.8),
}


def superficie(raio, ys, th, material, fora=True, eixo=None):
    """Superfície de revolução: raio(t) e y(t) para t em [0,1]."""
    P = np.stack([raio[:, None] * np.cos(th)[None, :], ys[:, None] * np.ones_like(th)[None, :], -raio[:, None] * np.sin(th)[None, :]], -1)
    pos, uv, tri = grade(P)
    p = Parte(pos, uv, tri, material)
    normais([p])
    ref = np.stack([np.zeros(len(pos)), pos[:, 1], np.zeros(len(pos))], 1) if eixo is None else eixo
    sinal = np.einsum("ij,ij->i", p.nrm, pos - ref).mean()
    if (sinal < 0) == fora:
        p.idx = p.idx[:, [0, 2, 1]]
        p.nrm = -p.nrm
    return p


def disco(raio, y, th, material, para_cima):
    t = np.linspace(0, 1, 8)
    P = np.stack([np.outer(t * raio, np.cos(th)), np.full((8, len(th)), y), -np.outer(t * raio, np.sin(th))], -1)
    pos, uv, tri = grade(P)
    p = Parte(pos, uv, tri, material)
    normais([p])
    if (p.nrm[:, 1].mean() > 0) != para_cima:
        p.idx = p.idx[:, [0, 2, 1]]; p.nrm = -p.nrm
    return p


def copo(rt, rb, H, estilo="vidro"):
    rt, rb, H = rt / 100, rb / 100, H / 100
    g, folga, base = VIDRO * rt, FOLGA * rt, BASE * rt * 1.4
    th = np.linspace(0, TAU, 129)
    s = AREA * 2 * rt                     # tamanho da área coberta (igual na montagem)
    k = 4 * DOMO / s                      # cúpula: y = pico − k·r²
    Hr = H                                # topo da borda do vidro
    t = np.linspace(0, 1, 40)
    # vidro: parede externa, interna, fundo grosso e borda arredondada
    vidro = [
        superficie(rb + (rt - rb) * t, Hr * t, th, "vidro", fora=True),
        superficie(rb - g + (rt - rb) * t, base + (Hr - base) * t, th, "vidro", fora=False),
        disco(rb, 0.0, th, "vidro", False),
        disco(rb - g + (rt - rb) * 0, base, th, "vidro", True),
    ]
    if estilo == "pet":
        # copo descartável: frisos perto da boca e anel no fundo, plástico mais fino e claro
        tf = np.linspace(0, 1, 160)
        friso = 0.00035 * np.clip(np.sin(np.clip((tf - 0.82) / 0.16, 0, 1) * math.pi * 5), 0, None) * (tf > 0.82)
        anel = 0.0006 * np.exp(-((tf - 0.04) / 0.012) ** 2)
        vidro[0] = superficie(rb + (rt - rb) * tf + friso + anel, Hr * tf, th, "vidro", fora=True)
    a = np.linspace(0, math.pi, 12)
    vidro.append(superficie(rt - g / 2 + (g / 2) * np.cos(a), Hr + (g / 2) * np.sin(a), th, "vidro_borda", fora=True,
                            eixo=None))
    vb = vidro[-1]
    centro_anel = np.stack([(rt - g / 2) * vb.pos[:, 0] / np.hypot(vb.pos[:, 0], vb.pos[:, 2]), np.full(len(vb.pos), Hr),
                            (rt - g / 2) * vb.pos[:, 2] / np.hypot(vb.pos[:, 0], vb.pos[:, 2])], 1)
    if np.einsum("ij,ij->i", vb.nrm, vb.pos - centro_anel).mean() < 0:
        vb.idx = vb.idx[:, [0, 2, 1]]; vb.nrm = -vb.nrm
    # açaí: parede encostando no vidro, fundo e topo em cúpula
    ra_t, ra_b = rt - g - folga, rb - g - folga
    y_borda = Hr - 0.0015
    pico = y_borda + k * ra_t ** 2
    y0 = base + 0.0004
    acai = [superficie(ra_b + (ra_t - ra_b) * t, y0 + (y_borda - y0) * t, th, "acai_parede", fora=True), disco(ra_b, y0, th, "acai_parede", False)]
    params = {"rt": rt, "rb": rb, "H": H, "g": g, "folga": folga, "base": base, "y0": y0, "y_borda": y_borda, "pico": pico, "k": k}
    tt = np.linspace(0, 1, 48)
    th2 = np.linspace(0, TAU, 193)
    r_ = ra_t * tt[:, None]
    dobra = 0.0009 * np.sin(5 * th2[None, :] + tt[:, None] * 9) * np.sin(math.pi * tt[:, None]) ** 2 * (0.6 + 0.4 * np.sin(3 * th2[None, :]))
    y = pico - k * r_ ** 2 + dobra
    P = np.stack([r_ * np.cos(th2)[None, :], y, -r_ * np.sin(th2)[None, :]], -1)
    pos, uv, tri = grade(P)
    pt = Parte(pos, uv, tri, "acai")
    normais([pt])
    if pt.nrm[:, 1].mean() < 0:
        pt.idx = pt.idx[:, [0, 2, 1]]; pt.nrm = -pt.nrm
    acai.append(pt)
    pet = estilo == "pet"
    mats = {
        "acai_parede": dict(tex=tex_acai_parede(), rough=0.3, relevo=relevo_acai_parede(), forca=3),
        "acai": dict(tex=tex_acai_topo(), rough=0.3, relevo=relevo_acai_topo(), forca=5),
        "vidro": dict(cor=[0.96, 0.98, 1.0, 0.1 if pet else 0.16], rough=0.06 if pet else 0.03, alfa=True, duplo=False, vidro=True),
        "vidro_borda": dict(cor=[0.97, 0.99, 1.0, 0.55 if pet else 0.45], rough=0.05, alfa=True, duplo=False),
        # usados pela montagem em camadas (public/glb.mjs procura pelo nome)
        "acai_camada": dict(tex=tex_acai_camada(), rough=0.28, relevo=relevo_acai_parede(), forca=3),
        "creme_parede": dict(tex=tex_creme_parede(), rough=0.32, relevo=relevo(134, 20), forca=2.5),
        "nutella_parede": dict(tex=tex_nutella_parede(), rough=0.22, relevo=relevo(143, 16), forca=2),
        "condensado_parede": dict(tex=mix(tex_creme_parede(256), hexrgb("#F3DFA8"), 0.35), rough=0.14, relevo=relevo(151, 14), forca=1.5),
        "chocolate_parede": dict(tex=mix(tex_nutella_parede(256), hexrgb("#1E0C05"), 0.5), rough=0.12, relevo=relevo(152, 14), forca=1.5),
        "po_parede": dict(tex=tex_ruido("#FFFEFA", "#EDE6D6", 153, 40), rough=1.0, relevo=relevo(154, 70), forca=6),
    }
    # interior separado: some quando a montagem desenha as camadas
    return [grupo(acai, {"interior": True}), grupo(vidro)], mats, params


# ---------------------------------------------------------------------------
# Ajudantes da animação: mão que coloca os pedaços e frasco de vidro que despeja a calda.
# Ficam na mesma escala das coberturas e só aparecem na animação da tela.
# ---------------------------------------------------------------------------
def capsula(pontos, raios, nu=14, n=40):
    """Dedo/peça arredondada: tubo ao longo de pontos com raio variável e pontas fechadas."""
    C = catmull(pontos, max(4, n // max(1, len(pontos) - 1)))
    t = np.linspace(0, 1, len(C))
    r = np.interp(t, np.linspace(0, 1, len(raios)), raios)
    ponta = np.clip(np.minimum(t, 1 - t) / 0.06, 0, 1)
    r = r * np.sqrt(1 - (1 - ponta) ** 2)
    return tubo_achatado(C, r, r, nu=nu)


def mao():
    """Mão direita, palma para baixo, fazendo pinça (polegar + indicador) na origem."""
    R = rot_eixos(ax=0.5)                        # punho para cima e para trás; dedos descem até a pinça
    def tr(p):
        return np.asarray(p, float) @ R.T
    partes = []
    palma = blob(np.zeros(3), (0.34, 0.12, 0.37), 7000, nt=18, nu=28, amp=0.04)
    palma.pos = tr(palma.pos + np.array([0.0, 0.34, -0.58])); palma.nrm = palma.nrm @ R.T
    partes.append(palma)
    # dedos: indicador e polegar fazem a pinça; os outros relaxados, um pouco abertos
    dedos = [
        ([[0.19, 0.34, -0.26], [0.17, 0.25, -0.1], [0.09, 0.1, -0.01], [0.025, 0.0, 0.01]], [0.082, 0.075, 0.066, 0.058]),
        ([[0.06, 0.36, -0.22], [0.05, 0.26, -0.04], [0.03, 0.11, 0.01], [0.0, 0.0, -0.06]], [0.084, 0.077, 0.068, 0.06]),
        ([[-0.07, 0.36, -0.24], [-0.08, 0.27, -0.08], [-0.1, 0.13, -0.05], [-0.12, 0.04, -0.12]], [0.08, 0.073, 0.064, 0.056]),
        ([[-0.2, 0.34, -0.3], [-0.23, 0.27, -0.17], [-0.26, 0.16, -0.15], [-0.27, 0.1, -0.22]], [0.068, 0.062, 0.055, 0.048]),
        ([[0.3, 0.27, -0.66], [0.32, 0.15, -0.38], [0.15, 0.04, -0.1], [0.045, -0.005, 0.0]], [0.1, 0.088, 0.074, 0.064]),   # polegar
    ]
    for pts, rs in dedos:
        partes.append(capsula(tr(pts), rs))
    pulso = capsula(tr([[0.0, 0.36, -0.86], [0.0, 0.4, -1.12], [0.0, 0.44, -1.4]]), [0.21, 0.19, 0.18])
    partes.append(pulso)
    pele = juntar(partes, "pele")
    # unhas
    unhas = []
    for pts, rs in dedos:
        a, b = np.asarray(tr(pts[-1])), np.asarray(tr(pts[-2]))
        eixo = (a - b) / np.linalg.norm(a - b)
        cima = np.cross(eixo, [1.0, 0, 0]); cima = cima / (np.linalg.norm(cima) + 1e-9)
        if cima[1] < 0:
            cima = -cima
        c = a - eixo * rs[-1] * 0.7 + cima * rs[-1] * 0.82
        u = blob(c, (rs[-1] * 0.62, rs[-1] * 0.16, rs[-1] * 0.75), 7100 + len(unhas), nt=8, nu=12, amp=0.0)
        unhas.append(u)
    unha = juntar(unhas, "unha")
    manga = capsula(tr([[0.0, 0.42, -1.2], [0.0, 0.47, -1.5], [0.0, 0.52, -1.9]]), [0.25, 0.27, 0.28])
    manga.material = "manga"
    return [grupo([pele, unha, manga], {"ajudante": "mao"}, np.zeros(3))], {
        "manga": dict(tex=tex_ruido("#3A1145", "#2A0B33", 43, 40), rough=0.8, relevo=relevo(44, 80), forca=2),
        "pele": dict(tex=tex_ruido("#E9B48E", "#D9997A", 41, 14), rough=0.52, relevo=relevo(42, 60), forca=1.5),
        "unha": dict(cor=[0.97, 0.84, 0.8, 1], rough=0.25),
    }


def frasco(cor_calda, nome_mat):
    """Frasco de vidro de calda, virado, com o bico na origem; jato de calda descendo."""
    th = np.linspace(0, TAU, 65)
    # perfil (raio, altura) a partir do bico (y=0) até o fundo (y=1,55)
    perfil = np.array([[0.035, 0.0], [0.05, 0.02], [0.06, 0.12], [0.075, 0.2], [0.14, 0.28], [0.27, 0.4], [0.33, 0.52],
                       [0.34, 0.7], [0.34, 1.35], [0.32, 1.5], [0.26, 1.55], [0.0, 1.56]])
    t = np.linspace(0, 1, 60)
    ks = np.linspace(0, 1, len(perfil))
    raio = np.interp(t, ks, perfil[:, 0])
    alt = np.interp(t, ks, perfil[:, 1])
    vidro_ext = superficie(raio, alt, th, "frasco_vidro", fora=True)
    # calda dentro do frasco (encosta no bico, ocupa a parte de baixo do vidro virado)
    raio_in = np.maximum(raio - 0.022, 0.012)
    fim = 0.62
    m = t <= fim
    calda_in = superficie(raio_in[m], alt[m], th, nome_mat, fora=True)
    tampa = disco(float(raio_in[m][-1]), float(alt[m][-1]), th, nome_mat, True)
    rotulo = superficie(np.full(10, 0.343), np.linspace(0.82, 1.18, 10), th, "rotulo", fora=True)
    R = rot_eixos(ax=-0.72)                      # corpo para cima e para trás; bico para baixo
    for p in (vidro_ext, calda_in, tampa, rotulo):
        p.pos = p.pos @ R.T
        p.nrm = p.nrm @ R.T
    jato = capsula([[0, 0.02, 0], [0, -0.5, 0], [0, -1.02, 0]], [0.04, 0.032, 0.036], nu=12)
    jato.material = nome_mat
    for p in (calda_in, tampa, jato):
        p.uv[:] = 0.5
    mats = {
        "frasco_vidro": dict(cor=[0.95, 0.97, 1.0, 0.22], rough=0.03, alfa=True, duplo=False, vidro=True),
        nome_mat: dict(cor=cor_calda, rough=0.12),
        "rotulo": dict(tex=tex_rotulo(), rough=0.5),
    }
    # o jato tem 1 unidade de comprimento para baixo: a montagem estica até o açaí
    return [grupo([calda_in, tampa, rotulo, vidro_ext], {"ajudante": "frasco"}, np.zeros(3)),
            grupo([jato], {"ajudante": "jato"}, np.zeros(3))], mats


def tex_rotulo(T=256):
    u, v = grade_uv(T)
    cor = mix(hexrgb("#F4EBDD"), hexrgb("#E8DCC6"), fbm(T, T, 51, base=8))
    faixa = (np.abs(v - 0.5) < 0.12)
    cor = np.where(faixa[..., None], mix(hexrgb("#6B1E2E"), hexrgb("#7E2738"), fbm(T, T, 52, base=10)), cor)
    return cor


AJUDANTES = {
    "_mao": mao,
    "_frasco_leite_condensado": lambda: frasco([0.95, 0.9, 0.78, 1], "leite_condensado"),
    "_frasco_calda_chocolate": lambda: frasco([0.13, 0.055, 0.025, 1], "calda_chocolate"),
    "_frasco_nutella": lambda: frasco([0.11, 0.045, 0.02, 1], "nutella"),
    "_pedacos_morango": pedacos_morango_biblioteca,
    "_pedacos_banana": biblioteca_banana,
    "_pedacos_granola": biblioteca_granola,
    "_pedacos_pacoca": biblioteca_pacoca,
    "_pedacos_confete": biblioteca_confete,
}


# ---------------------------------------------------------------------------
# Escrita GLB com vários nós (um por pedaço)
# ---------------------------------------------------------------------------
def escrever(caminho, nome, grupos, materiais, extras):
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

    usados = []
    for g in grupos:
        for p in g["partes"]:
            if p.material not in usados:
                usados.append(p.material)
    for mn in materiais:           # materiais sem malha também vão (biblioteca da montagem)
        if mn not in usados:
            usados.append(mn)
    mats, images, textures, ids = [], [], [], {}
    for mn in usados:
        m = materiais[mn]
        pbr = {"metallicFactor": 0.0, "roughnessFactor": m["rough"]}
        if m.get("tex") is not None:
            images.append({"bufferView": add_view(to_jpeg(m["tex"], 88)), "mimeType": "image/jpeg"})
            textures.append({"sampler": 0, "source": len(images) - 1})
            pbr["baseColorTexture"] = {"index": len(textures) - 1}
        if m.get("cor"):
            pbr["baseColorFactor"] = m["cor"]
        mat = {"name": mn, "doubleSided": m.get("duplo", True), "pbrMetallicRoughness": pbr}
        if m.get("relevo") is not None:
            images.append({"bufferView": add_view(to_jpeg(mapa_normais(m["relevo"], m.get("forca", 4.0)), 92)), "mimeType": "image/jpeg"})
            textures.append({"sampler": 0, "source": len(images) - 1})
            mat["normalTexture"] = {"index": len(textures) - 1}
        if m.get("alfa"):
            mat["alphaMode"] = "BLEND"
        if m.get("vidro"):
            mat["extensions"] = {"KHR_materials_ior": {"ior": 1.5}, "KHR_materials_specular": {"specularFactor": 1.0}}
        mats.append(mat)
        ids[mn] = len(mats) - 1

    meshes, nodes = [], []
    for gi, g in enumerate(grupos):
        allpos = np.concatenate([p.pos for p in g["partes"]])
        c = np.asarray(g["centro"] if g["centro"] is not None else (allpos.min(0) + allpos.max(0)) / 2, float)
        prims = []
        for p in g["partes"]:
            prims.append({
                "attributes": dict({
                    "POSITION": add_acc((p.pos - c).astype(np.float32), "VEC3", 5126, 34962, True),
                    "NORMAL": add_acc(p.nrm.astype(np.float32), "VEC3", 5126, 34962),
                    "TEXCOORD_0": add_acc(p.uv.astype(np.float32), "VEC2", 5126, 34962),
                }, **({"COLOR_0": add_acc(np.asarray(p.cor, np.float32), "VEC3", 5126, 34962)} if getattr(p, "cor", None) is not None else {})),
                "indices": add_acc(p.idx.astype(np.uint32).reshape(-1, 1), "SCALAR", 5125, 34963),
                "material": ids[p.material],
            })
        meshes.append({"name": f"{nome}_{gi}", "primitives": prims})
        no = {"name": f"{nome}_{gi}", "mesh": len(meshes) - 1}
        if np.any(np.abs(c) > 1e-9):
            no["translation"] = [float(x) for x in c]
        if g["extras"]:
            no["extras"] = g["extras"]
        nodes.append(no)
    exts = sorted({e for m in mats for e in m.get("extensions", {})})
    gltf = {
        "asset": {"version": "2.0", "generator": "MenuReal AR gerar_acai.py",
                  "copyright": "MenuReal AR — modelo ilustrativo original (CC0 1.0)", "extras": extras},
        "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes, "meshes": meshes, "materials": mats, "accessors": accs, "bufferViews": views,
        "buffers": [{"byteLength": 0}],
    }
    if exts:
        gltf["extensionsUsed"] = exts
    if images:
        gltf.update(images=images, textures=textures,
                    samplers=[{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 33071}])
    while len(bin_) % 4:
        bin_.append(0)
    gltf["buffers"][0]["byteLength"] = len(bin_)
    js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(js) % 4:
        js += b" "
    with open(caminho, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942))
        f.write(bin_)


def main():
    os.makedirs(os.path.join(RAIZ, "adicionais"), exist_ok=True)
    for estilo, sufixo in (("vidro", ""), ("pet", "-pet")):
        for nome, (rt, rb, H) in COPOS.items():
            nome = nome.replace("acai-", "acai" + sufixo + "-")
            grupos, mats, params = copo(rt, rb, H, estilo)
            allpos = np.concatenate([p.pos for g in grupos for p in g["partes"]])
            d = (allpos.max(0) - allpos.min(0)) * 100
            destino = os.path.join(RAIZ, "models", nome + ".glb")
            escrever(destino, nome, grupos, mats, {"unidade": "metro", "dimensoes_cm": {"largura_x": round(d[0], 2), "profundidade_z": round(d[2], 2), "altura_y": round(d[1], 2)},
                                                   "aviso": "Modelo ilustrativo; medidas de copos comuns de 300, 500 e 700 ml.",
                                                   "copo": {k: round(float(v), 6) for k, v in params.items()}})
            ntri = sum(len(p.idx) for g in grupos for p in g["partes"])
            print(f"{nome:18s} {d[0]:.1f} × {d[2]:.1f} × {d[1]:.1f} cm  {ntri:6d} tri  {os.path.getsize(destino) / 1024:5.0f} KB")
    for nome, fn in AJUDANTES.items():
        grupos, mats = fn()
        destino = os.path.join(RAIZ, "adicionais", nome + ".glb")
        escrever(destino, nome, grupos, mats, {"menureal": "ajudante da animação (escala das coberturas)"})
        print(f"ajudante {nome:26s} {os.path.getsize(destino) / 1024:5.0f} KB")
    for tipo, fn in CAMADAS.items():
        grupos, mats = fn()
        destino = os.path.join(RAIZ, "adicionais", tipo + ".glb")
        escrever(destino, tipo, grupos, mats, {"menureal": "cobertura normalizada (1 = área coberta)"})
        ntri = sum(len(p.idx) for g in grupos for p in g["partes"])
        print(f"adicional {tipo:18s} {len(grupos):3d} pedaços {ntri:6d} tri  {os.path.getsize(destino) / 1024:5.0f} KB")


if __name__ == "__main__":
    main()
