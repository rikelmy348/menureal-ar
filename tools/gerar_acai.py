#!/usr/bin/env python3
"""
MenuReal AR — copos de açaí e adicionais em 3D (ilustrativos, originais, CC0).

Gera:
  public/assets/models/acai-300.glb, acai-500.glb, acai-700.glb   copos com açaí
  public/assets/adicionais/<tipo>.glb                             camadas de cobertura

As camadas de adicionais são "normalizadas": ocupam um círculo de 1 m de diâmetro
centrado na origem, apoiadas numa cúpula y = DOMO·(1 − (r/0.5)²). Na hora de montar
o açaí (public/glb.mjs), cada camada é escalada para a boca do copo e posta no topo.
O topo do açaí nos copos usa a mesma cúpula, então as coberturas assentam certinho.

Uso: pip install numpy pillow && python3 tools/gerar_acai.py
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from gerar_modelos import (Parte, S, TAU, escrever_glb, fbm, grade, hexrgb, mix,  # noqa: E402
                           normais)

DOMO = 0.08          # altura da cúpula da cobertura / diâmetro da área coberta
AREA = 0.80          # diâmetro da área coberta / largura do copo (igual em public/glb.mjs)
RAIZ = os.path.join(os.path.dirname(__file__), "..", "public", "assets")


def domo(x, z):
    r2 = (np.asarray(x) ** 2 + np.asarray(z) ** 2) / 0.25
    return DOMO * np.clip(1 - r2, 0, 1)


# ---------------------------------------------------------------------------
# Peças básicas
# ---------------------------------------------------------------------------
def orientar(p, centro):
    """Garante normais e triângulos voltados para fora da peça."""
    normais([p])
    if np.einsum("ij,ij->i", p.nrm, p.pos - centro).mean() < 0:
        p.idx = p.idx[:, [0, 2, 1]]
        p.nrm = -p.nrm
    return p


def juntar(pecas, material):
    pos, uv, idx, nrm, base = [], [], [], [], 0
    for p in pecas:
        pos.append(p.pos); uv.append(p.uv); nrm.append(p.nrm); idx.append(p.idx + base)
        base += len(p.pos)
    parte = Parte(np.concatenate(pos), np.concatenate(uv), np.concatenate(idx), material)
    parte.nrm = np.concatenate(nrm)
    return parte


def rot_aleatoria(r):
    q = r.normal(size=4)
    q /= np.linalg.norm(q)
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def blob(centro, raios, seed, nt=7, nu=10, amp=0.25, girar=True, uv=None):
    """Pedacinho irregular (esfera deformada)."""
    r = np.random.default_rng(seed)
    t = np.linspace(0, 1, nt)[:, None]
    th = np.linspace(0, TAU, nu + 1)[None, :]
    k = r.uniform(0, TAU, 3)
    ruido = 1 + amp * (0.5 * np.sin(2 * th + k[0]) * np.sin(math.pi * t * 2 + k[1]) + 0.5 * np.sin(3 * th + k[2]) * np.sin(math.pi * t))
    P = np.stack([np.sin(math.pi * t) * np.cos(th) * ruido, -np.cos(math.pi * t) * np.ones_like(th) * ruido,
                  -np.sin(math.pi * t) * np.sin(th) * ruido], -1)
    pos, u, tri = grade(P)
    pos = pos * np.asarray(raios)
    if girar:
        pos = pos @ rot_aleatoria(r).T
    if uv is not None:
        u = np.tile(np.asarray(uv, np.float32), (len(u), 1))
    p = Parte(pos + centro, u, tri, "")
    return orientar(p, np.asarray(centro, float))


def placa(contorno, espessura, centro, angulo=0.0, inclinacao=(0, 0), niveis=6):
    """Peça achatada com o contorno dado (rodela, fatia): topo, fundo e lateral."""
    c = np.asarray(contorno, float)            # (n, 2) em x/z, centrado em 0
    n = len(c)
    fech = np.vstack([c, c[:1]])
    lv = np.linspace(0, 1, niveis)[:, None, None]
    topo = np.concatenate([fech[None] * lv, np.full((niveis, n + 1, 1), espessura)], -1)[..., [0, 2, 1]]
    fundo = np.concatenate([fech[None] * lv[::-1], np.zeros((niveis, n + 1, 1))], -1)[..., [0, 2, 1]]
    lado = np.stack([np.concatenate([fech, np.zeros((n + 1, 1))], 1)[:, [0, 2, 1]],
                     np.concatenate([fech, np.full((n + 1, 1), espessura)], 1)[:, [0, 2, 1]]])
    pecas = []
    for P, vfaixa in ((topo, (0.0, 0.5)), (lado, (0.5, 0.6)), (fundo, (0.6, 1.0))):
        pos, uv, tri = grade(P)
        uv[:, 1] = vfaixa[0] + uv[:, 1] * (vfaixa[1] - vfaixa[0])
        pecas.append((pos, uv, tri))
    pos = np.concatenate([p[0] for p in pecas])
    uv = np.concatenate([p[1] for p in pecas])
    off = np.cumsum([0] + [len(p[0]) for p in pecas])
    tri = np.concatenate([p[2] + off[i] for i, p in enumerate(pecas)])
    pos[:, 1] -= espessura / 2
    ix, iz = inclinacao
    rx = np.array([[1, 0, 0], [0, math.cos(ix), -math.sin(ix)], [0, math.sin(ix), math.cos(ix)]])
    rz = np.array([[math.cos(iz), -math.sin(iz), 0], [math.sin(iz), math.cos(iz), 0], [0, 0, 1]])
    pos = pos @ (rot_y(angulo) @ rx @ rz).T
    p = Parte(pos + centro, uv, tri, "")
    return orientar(p, np.asarray(centro, float))


def tubo(caminho, raio, nu=8):
    """Fio de calda ao longo de um caminho (lista de pontos)."""
    C = np.asarray(caminho, float)
    tg = np.gradient(C, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True)
    up = np.array([0, 1, 0])
    b1 = np.cross(tg, up)
    b1 /= np.linalg.norm(b1, axis=1, keepdims=True) + 1e-9
    b2 = np.cross(b1, tg)
    th = np.linspace(0, TAU, nu + 1)
    # calda escorre achatada: mais larga que alta
    P = C[:, None, :] + raio * (1.25 * np.cos(th)[None, :, None] * b1[:, None, :] + 0.75 * np.sin(th)[None, :, None] * b2[:, None, :])
    pos, uv, tri = grade(P)
    p = Parte(pos, uv, tri, "")
    normais([p])
    # normais para fora do fio
    viz = np.repeat(C, nu + 1, axis=0)
    if np.einsum("ij,ij->i", p.nrm, pos - viz).mean() < 0:
        p.idx = p.idx[:, [0, 2, 1]]
        p.nrm = -p.nrm
    return p


def pontos_no_disco(r, n, raio_max=0.44, dist_min=0.05):
    pts = []
    tent = 0
    while len(pts) < n and tent < n * 400:
        tent += 1
        a, d = r.uniform(0, TAU), raio_max * math.sqrt(r.uniform(0, 1))
        x, z = d * math.cos(a), d * math.sin(a)
        if all((x - px) ** 2 + (z - pz) ** 2 > dist_min ** 2 for px, pz in pts):
            pts.append((x, z))
    return pts


# ---------------------------------------------------------------------------
# Texturas
# ---------------------------------------------------------------------------
def tex_ruido(c1, c2, seed, base=10):
    return mix(hexrgb(c1), hexrgb(c2), fbm(S, S, seed, base=base, octaves=5))


def tex_banana():
    v = np.linspace(0, 1, S)[:, None] * np.ones((1, S))
    u = np.ones((S, 1)) * np.linspace(0, 1, S)[None, :]
    cor = mix(hexrgb("#FBF1C9"), hexrgb("#F3DE9B"), fbm(S, S, 81, base=12) * 0.8)
    # topo (v 0–0.5): centro → borda. Anel de sementes perto do centro
    rad = v / 0.5
    anel = np.exp(-((rad - 0.32) / 0.07) ** 2) * (0.5 + 0.5 * np.sin(u * TAU * 3))
    cor = mix(cor, hexrgb("#E7CF8A"), np.where(v < 0.5, anel * 0.9, 0))
    r = np.random.default_rng(5)
    for _ in range(26):
        cu, cv = r.uniform(0, 1), r.uniform(0.13, 0.19)
        d = ((u - cu) * 3) ** 2 + ((v - cv) * 9) ** 2
        cor = mix(cor, hexrgb("#6B4A2B"), np.exp(-d * 900) * 0.9)
    cor = mix(cor, hexrgb("#EAD9A0"), np.where((v > 0.5) & (v < 0.6), 0.6, 0))  # casca/borda
    return cor


def tex_morango():
    v = np.linspace(0, 1, S)[:, None] * np.ones((1, S))
    rad = np.clip(v / 0.5, 0, 1)
    miolo = mix(hexrgb("#FCE3E3"), hexrgb("#F28C93"), rad ** 1.6)
    veios = 0.5 + 0.5 * np.sin(np.linspace(0, 1, S)[None, :] * TAU * 9 + rad * 3)
    miolo = mix(miolo, hexrgb("#FFF2F2"), (1 - rad) * veios * 0.35)
    cor = np.where((v < 0.5)[..., None], mix(miolo, hexrgb("#C8102E"), np.clip((rad - 0.78) / 0.22, 0, 1)), hexrgb("#C21A2C"))
    n = fbm(S, S, 91, base=20)
    return mix(cor, hexrgb("#9E0F22"), np.where(v >= 0.5, n * 0.5, 0))


def tex_confete():
    cores = ["#D7263D", "#F4C20D", "#1B75D0", "#2DA44E", "#F57C00", "#6D3B23"]
    img = np.zeros((S, S, 3), np.float32)
    w = S // len(cores)
    for i, c in enumerate(cores):
        img[:, i * w:(i + 1) * w] = hexrgb(c)
    img[:, len(cores) * w:] = hexrgb(cores[-1])
    return img


def tex_copo():
    v = np.linspace(0, 1, S)[:, None] * np.ones((1, S))
    base = mix(hexrgb("#1E0620"), hexrgb("#3A0E3E"), v)       # mais escuro embaixo (v=0)
    n = fbm(S, S, 101, base=6, octaves=4)
    cor = mix(base, hexrgb("#55205A"), n * 0.4)
    brilho = np.exp(-((np.linspace(0, 1, S)[None, :] - 0.18) / 0.025) ** 2) * 0.35  # reflexo vertical do plástico
    return mix(cor, hexrgb("#E8D8EC"), brilho * np.ones((S, 1)))


def tex_acai_topo():
    n1 = fbm(S, S, 111, base=5, octaves=5)
    n2 = fbm(S, S, 112, base=14, octaves=4)
    cor = mix(hexrgb("#2A0730"), hexrgb("#4A1450"), n1)
    return mix(cor, hexrgb("#6A2E70"), np.clip(n2 - 0.55, 0, 1) * 1.6)


MATS = {
    "granola": dict(tex=None, rough=0.82),
    "banana": dict(tex=None, rough=0.55),
    "morango": dict(tex=None, rough=0.4),
    "leite_condensado": dict(tex=None, rough=0.22),
    "calda_chocolate": dict(tex=None, rough=0.25),
    "leite_po": dict(tex=None, rough=0.95),
    "pacoca": dict(tex=None, rough=0.9),
    "confete": dict(tex=None, rough=0.35),
}


# ---------------------------------------------------------------------------
# Camadas de adicionais (normalizadas)
# ---------------------------------------------------------------------------
def sobre(x, z, folga=0.0):
    return np.array([x, float(domo(x, z)) + folga, z])


def camada_granola():
    r = np.random.default_rng(11)
    pecas = []
    for i, (x, z) in enumerate(pontos_no_disco(r, 60, 0.45, 0.055)):
        rx = r.uniform(0.032, 0.055)
        pecas.append(blob(sobre(x, z, rx * 0.25), (rx, rx * r.uniform(0.45, 0.7), rx * r.uniform(0.7, 1.1)), 200 + i, amp=0.35))
    return [juntar(pecas, "granola")], {"granola": dict(tex=tex_ruido("#C68B3E", "#8A5520", 12, 24), rough=0.82)}


def camada_pacoca():
    r = np.random.default_rng(12)
    pecas = []
    for i, (x, z) in enumerate(pontos_no_disco(r, 50, 0.42, 0.05)):
        rx = r.uniform(0.024, 0.042)
        pecas.append(blob(sobre(x, z, rx * 0.3), (rx, rx * 0.8, rx * 1.1), 400 + i, nt=5, nu=6, amp=0.2))
    return [juntar(pecas, "pacoca")], {"pacoca": dict(tex=tex_ruido("#D8B07A", "#B98B52", 13, 30), rough=0.9)}


def camada_confete():
    r = np.random.default_rng(13)
    pecas = []
    for i, (x, z) in enumerate(pontos_no_disco(r, 30, 0.43, 0.075)):
        cor = (i % 6 + 0.5) / 6
        pecas.append(blob(sobre(x, z, 0.016), (0.042, 0.018, 0.042), 600 + i, nt=7, nu=12, amp=0.0, girar=False, uv=(cor, 0.5)))
    return [juntar(pecas, "confete")], {"confete": dict(tex=tex_confete(), rough=0.35)}


def camada_banana():
    r = np.random.default_rng(14)
    pecas = []
    th = np.linspace(0, TAU, 28, endpoint=False)
    for i in range(9):
        a = TAU * i / 8 + 0.2
        d = 0.0 if i == 8 else 0.29
        x, z = d * math.cos(a), d * math.sin(a)
        R = 0.1 * r.uniform(0.92, 1.05)
        cont = np.stack([R * np.cos(th) * (1 + 0.03 * np.sin(5 * th)), R * np.sin(th)], 1)
        incl = (-0.35 * z / 0.5, 0.35 * x / 0.5)
        pecas.append(placa(cont, 0.036, sobre(x, z, 0.024), angulo=r.uniform(0, TAU), inclinacao=incl))
    return [juntar(pecas, "banana")], {"banana": dict(tex=tex_banana(), rough=0.55)}


def camada_morango():
    r = np.random.default_rng(15)
    pecas = []
    th = np.linspace(0, TAU, 32, endpoint=False)
    for i in range(6):
        a = TAU * i / 6 + 0.55
        d = 0.2 if i % 2 else 0.33
        x, z = d * math.cos(a), d * math.sin(a)
        # fatia em formato de gota (morango cortado no comprimento)
        L, W = 0.16, 0.105
        px = W * np.sin(th) * (0.75 + 0.25 * np.cos(th))
        pz = L * 0.5 * np.cos(th)
        cont = np.stack([px, pz], 1)
        incl = (-0.35 * z / 0.5, 0.35 * x / 0.5)
        pecas.append(placa(cont, 0.028, sobre(x, z, 0.02), angulo=a + r.uniform(-0.4, 0.4), inclinacao=incl))
    return [juntar(pecas, "morango")], {"morango": dict(tex=tex_morango(), rough=0.4)}


def caminho_calda(fase, voltas, rot):
    s = np.linspace(0, 1, 340)
    z = -0.40 + 0.80 * s
    larg = np.sqrt(np.clip(0.44 ** 2 - z ** 2, 0, None))
    x = larg * np.sin(TAU * voltas * s + fase) * 0.95
    P = np.stack([x, np.zeros_like(x), z], 1) @ rot_y(rot).T
    P[:, 1] = domo(P[:, 0], P[:, 2]) + 0.03
    return P


def camada_leite_condensado():
    p = tubo(caminho_calda(0.3, 3.5, 0.35), 0.024)
    p.material = "leite_condensado"
    p.uv[:] = 0.5
    return [p], {"leite_condensado": dict(tex=np.full((S, S, 3), hexrgb("#F6EEDB"), np.float32), rough=0.22)}


def camada_calda_chocolate():
    p = tubo(caminho_calda(1.7, 4.0, math.pi / 2 + 0.2), 0.022)
    p.material = "calda_chocolate"
    p.uv[:] = 0.5
    return [p], {"calda_chocolate": dict(tex=np.full((S, S, 3), hexrgb("#3B1F12"), np.float32), rough=0.25)}


def camada_leite_po():
    r = np.random.default_rng(16)
    cx, cz = 0.12, -0.1
    pecas = [blob(sobre(cx, cz, -0.01), (0.17, 0.065, 0.16), 900, nt=12, nu=18, amp=0.12, girar=False)]
    for i, (x, z) in enumerate(pontos_no_disco(r, 26, 0.38, 0.05)):
        rx = r.uniform(0.012, 0.022)
        pecas.append(blob(sobre(x, z, rx * 0.2), (rx, rx * 0.5, rx), 950 + i, nt=5, nu=6, amp=0.1))
    return [juntar(pecas, "leite_po")], {"leite_po": dict(tex=tex_ruido("#FBFAF5", "#ECE7DA", 17, 20), rough=0.95)}


CAMADAS = {
    "granola": camada_granola,
    "pacoca": camada_pacoca,
    "confete": camada_confete,
    "banana": camada_banana,
    "morango": camada_morango,
    "leite_po": camada_leite_po,
    "leite_condensado": camada_leite_condensado,
    "calda_chocolate": camada_calda_chocolate,
}


# ---------------------------------------------------------------------------
# Copos de açaí (em metros)
# ---------------------------------------------------------------------------
COPOS = {  # raio da boca, raio do fundo, altura total (cm)
    "acai-300": (4.3, 3.0, 9.0),
    "acai-500": (4.8, 3.3, 11.0),
    "acai-700": (5.3, 3.6, 12.8),
}
LABIO = 0.22  # raio do "lábio" da borda (cm)


def copo(rt, rb, H):
    rt, rb, H, lab = rt / 100, rb / 100, H / 100, LABIO / 100
    largura = 2 * (rt + lab)
    s = AREA * largura                      # diâmetro da área coberta (igual na montagem)
    k = DOMO * s / (s / 2) ** 2             # cúpula: y = H − k·r²
    Hr = H - k * rt ** 2                    # altura da borda
    nu = 96
    th = np.linspace(0, TAU, nu + 1)
    partes = []
    # parede (açaí visto pelo plástico)
    t = np.linspace(0, 1, 24)[:, None]
    rr = rb + (rt - rb) * t
    P = np.stack([rr * np.cos(th), Hr * t * np.ones_like(th), -rr * np.sin(th)], -1)
    pos, uv, tri = grade(P)
    partes.append(orientar(Parte(pos, uv, tri, "copo"), np.array([0, Hr / 2, 0])))
    # fundo
    t = np.linspace(0, 1, 6)[:, None]
    P = np.stack([rb * t * np.cos(th), np.zeros((6, nu + 1)), rb * t * np.sin(th)], -1)
    pos, uv, tri = grade(P)
    pf = Parte(pos, uv, tri, "copo")
    normais([pf])
    if pf.nrm[:, 1].mean() > 0:
        pf.idx = pf.idx[:, [0, 2, 1]]; pf.nrm = -pf.nrm
    partes.append(pf)
    # lábio da borda (toro)
    a = np.linspace(0, TAU, 14)[:, None]
    R = rt + lab * np.cos(a)
    P = np.stack([R * np.cos(th), Hr + lab * np.sin(a) * np.ones_like(th), -R * np.sin(th)], -1)
    pos, uv, tri = grade(P)
    pl = Parte(pos, uv, tri, "borda")
    normais([pl])
    centro_anel = np.stack([rt * np.cos(np.arctan2(-pos[:, 2], pos[:, 0])), np.full(len(pos), Hr),
                            -rt * np.sin(np.arctan2(-pos[:, 2], pos[:, 0]))], 1)
    if np.einsum("ij,ij->i", pl.nrm, pos - centro_anel).mean() < 0:
        pl.idx = pl.idx[:, [0, 2, 1]]; pl.nrm = -pl.nrm
    partes.append(pl)
    # topo do açaí (cúpula cremosa)
    t = np.linspace(0, 1, 20)[:, None]
    r_ = rt * 1.0 * t
    ond = 1 + 0.004 * np.sin(7 * th) * t
    y = (H - k * r_ ** 2) * ond / ond.mean()
    P = np.stack([r_ * np.cos(th), y, -r_ * np.sin(th)], -1)
    pos, uv, tri = grade(P)
    pt = Parte(pos, uv, tri, "acai")
    normais([pt])
    if pt.nrm[:, 1].mean() < 0:
        pt.idx = pt.idx[:, [0, 2, 1]]; pt.nrm = -pt.nrm
    partes.append(pt)
    mats = {
        "copo": dict(tex=tex_copo(), rough=0.18),
        "borda": dict(tex=np.full((S, S, 3), hexrgb("#EDE6EE"), np.float32), rough=0.3),
        "acai": dict(tex=tex_acai_topo(), rough=0.55),
    }
    return partes, mats


def main():
    os.makedirs(os.path.join(RAIZ, "adicionais"), exist_ok=True)
    for nome, (rt, rb, H) in COPOS.items():
        partes, mats = copo(rt, rb, H)
        allpos = np.concatenate([p.pos for p in partes])
        d = (allpos.max(0) - allpos.min(0)) * 100
        destino = os.path.join(RAIZ, "models", nome + ".glb")
        escrever_glb(destino, nome, partes, mats, (round(d[0], 2), round(d[2], 2), round(d[1], 2)))
        print(f"{nome:18s} {d[0]:.1f} × {d[2]:.1f} × {d[1]:.1f} cm  {sum(len(p.idx) for p in partes):6d} tri  {os.path.getsize(destino) / 1024:5.0f} KB")
    for tipo, fn in CAMADAS.items():
        partes, mats = fn()
        allpos = np.concatenate([p.pos for p in partes])
        d = allpos.max(0) - allpos.min(0)
        destino = os.path.join(RAIZ, "adicionais", tipo + ".glb")
        escrever_glb(destino, tipo, partes, mats, (1, 1, 1))
        print(f"adicional {tipo:18s} {d[0]:.2f} × {d[2]:.2f} × {d[1]:.3f}  {sum(len(p.idx) for p in partes):6d} tri  {os.path.getsize(destino) / 1024:5.0f} KB")


if __name__ == "__main__":
    main()
