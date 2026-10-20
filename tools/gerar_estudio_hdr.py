#!/usr/bin/env python3
"""
Gera public/assets/estudio.hdr: iluminação de estúdio fotográfico (HDR, equiretangular)
usada pelo <model-viewer> para reflexos e luz dos produtos 3D. Criada do zero
(sem fotos de terceiros), domínio público (CC0).

Uso: pip install numpy && python3 tools/gerar_estudio_hdr.py
"""
import os
import numpy as np

L, A = 512, 256
u = (np.arange(L) + 0.5) / L
v = (np.arange(A) + 0.5) / A
fi = (u - 0.5) * 2 * np.pi            # longitude: 0 = frente da câmera
te = (0.5 - v) * np.pi                # latitude: +90° em cima
FI, TE = np.meshgrid(fi, te)


def caixa(centro_fi, centro_te, larg, alt, suave=0.35):
    """Softbox retangular com bordas suaves (ângulos em graus)."""
    dfi = np.angle(np.exp(1j * (FI - np.radians(centro_fi))))
    dte = TE - np.radians(centro_te)
    x = np.abs(dfi) / np.radians(larg / 2)
    y = np.abs(dte) / np.radians(alt / 2)
    m = np.clip((1 + suave - np.maximum(x, y)) / suave, 0, 1)
    return m * m * (3 - 2 * m)


img = np.zeros((A, L, 3))
# fundo: teto claro e neutro, horizonte cinza, chão quente e escuro
t = (TE / (np.pi / 2))
ceu = np.clip(t, 0, 1)[..., None]
chao = np.clip(-t, 0, 1)[..., None]
img += 0.14 * np.array([1.0, 1.0, 1.0]) * (1 - chao) + 0.06 * ceu
img = img * (1 - chao) + chao * np.array([0.10, 0.085, 0.07])
# luzes
img += 13.0 * caixa(35, 32, 50, 36)[..., None] * np.array([1.0, 0.95, 0.88])    # principal, quente, frente-direita
img += 1.8 * caixa(-65, 18, 70, 45)[..., None] * np.array([0.93, 0.97, 1.0])   # preenchimento, fria, esquerda
img += 2.4 * caixa(0, 82, 360, 16, 0.6)[..., None] * np.array([1.0, 1.0, 1.0])  # luz de teto
img += 7.0 * caixa(180, 28, 34, 55)[..., None] * np.array([1.0, 0.98, 0.95])   # contraluz (contorno)
img += 0.6 * caixa(0, -8, 120, 10, 0.8)[..., None] * np.array([1.0, 0.96, 0.9]) # rebatedor na mesa


def rgbe(px):
    m = px.max(axis=-1)
    e = np.ceil(np.log2(np.maximum(m, 1e-32)))
    esc = np.where(m > 1e-32, 256.0 / np.power(2.0, e), 0)
    out = np.zeros(px.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(px * esc[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(m > 1e-32, e + 128, 0).astype(np.uint8)
    return out


destino = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "estudio.hdr")
with open(destino, "wb") as f:
    f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n" % (A, L))
    dados = rgbe(img.astype(np.float64))
    for linha in dados:  # compressão RLE por linha (formato Radiance "novo")
        f.write(bytes([2, 2, L >> 8, L & 255]))
        for c in range(4):
            canal = linha[:, c].tolist()
            i = 0
            while i < L:
                n = 1
                while i + n < L and n < 127 and canal[i + n] == canal[i]:
                    n += 1
                if n >= 3:
                    f.write(bytes([128 + n, canal[i]])); i += n; continue
                j = i
                while j < L and j - i < 128:
                    if j + 2 < L and canal[j] == canal[j + 1] == canal[j + 2]:
                        break
                    j += 1
                f.write(bytes([j - i] + canal[i:j])); i = j
print("Gerado:", os.path.normpath(destino), "%.0f KB" % (os.path.getsize(destino) / 1024))
