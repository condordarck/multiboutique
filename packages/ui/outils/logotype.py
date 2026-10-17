"""Génère le logotype et l'icône de MultiBoutique depuis Bricolage Grotesque.

Les lettres sont vectorisées : les SVG produits ne dépendent d'aucune police.
Le logo retenu est la proposition « Étiquette » : mot en encre, icône « M »
blanche sur carré bleu, avec une pastille safran (l'œillet d'une étiquette).

Prérequis : Python 3 avec fonttools et brotli (pip install fonttools brotli).
Usage, depuis la racine du dépôt :

    python -I packages/ui/outils/logotype.py \\
      node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2 \\
      packages/ui/assets

Couleurs : docs/superpowers/specs/2026-10-17-identite-visuelle.md.
"""
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

PRIMAIRE, TEXTE, SAFRAN, BLANC = "#2B50D9", "#1F1B16", "#E0A526", "#FFFFFF"
GRAISSE, TAILLE_OPTIQUE, APPROCHE = 800, 96, -0.02

police = TTFont(sys.argv[1])
sortie = Path(sys.argv[2])
sortie.mkdir(parents=True, exist_ok=True)
cmap = police.getBestCmap()
jeu = police.getGlyphSet(location={"wght": GRAISSE, "opsz": TAILLE_OPTIQUE})


def vectoriser(texte, approche):
    """Chemin SVG (unités de la police, y vers le bas) et boîte englobante."""
    stylo, bornes, x = SVGPathPen(jeu), BoundsPen(jeu), 0.0
    for i, car in enumerate(texte):
        glyphe = jeu[cmap[ord(car)]]
        # Police : y vers le haut ; SVG : y vers le bas.
        glyphe.draw(TransformPen(stylo, (1, 0, 0, -1, x, 0)))
        glyphe.draw(TransformPen(bornes, (1, 0, 0, -1, x, 0)))
        x += glyphe.width + (approche * police["head"].unitsPerEm if i < len(texte) - 1 else 0)
    return stylo.getCommands(), bornes.bounds


def logotype(couleur, marge=20):
    d, (xmin, ymin, xmax, ymax) = vectoriser("MultiBoutique", APPROCHE)
    vb = f"{xmin - marge:.0f} {ymin - marge:.0f} {xmax - xmin + 2 * marge:.0f} {ymax - ymin + 2 * marge:.0f}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="MultiBoutique">'
            f'<path fill="{couleur}" d="{d}"/></svg>\n')


def icone():
    """Icône carrée de 1024, source des icônes de la PWA (pwa-assets.config.ts)."""
    T = 1024
    d, (xmin, ymin, xmax, ymax) = vectoriser("M", -0.03)
    largeur, hauteur = xmax - xmin, ymax - ymin
    echelle = T * 0.46 / max(largeur, hauteur)
    # Centrage optique : léger décalage vers le bas-gauche, qui équilibre la pastille.
    tx = (T - largeur * echelle) / 2 - xmin * echelle - 0.02 * T
    ty = (T - hauteur * echelle) / 2 - ymin * echelle + 0.03 * T
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {T} {T}" role="img" aria-label="MultiBoutique">'
            f'<rect width="{T}" height="{T}" rx="{T * 0.225:.0f}" fill="{PRIMAIRE}"/>'
            f'<path fill="{BLANC}" transform="translate({tx:.1f} {ty:.1f}) scale({echelle:.4f})" d="{d}"/>'
            f'<circle cx="{T * 0.79:.0f}" cy="{T * 0.21:.0f}" r="{T * 0.065:.0f}" fill="{SAFRAN}"/></svg>\n')


fichiers = {
    "logo.svg": logotype(TEXTE),
    # currentColor : le logo prend la couleur du texte qui l'entoure (fond sombre, impression).
    "logo-monochrome.svg": logotype("currentColor"),
    "icone.svg": icone(),
}
for nom, contenu in fichiers.items():
    (sortie / nom).write_text(contenu)
    print(f"{nom} : {len(contenu)} octets")
