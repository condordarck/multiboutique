#!/usr/bin/env bash
set -euo pipefail

# Teste deplacer_uploads (deploy/lib/uploads.sh) dans des dossiers temporaires.
#   bash deploy/test/deplacer-uploads.test.sh

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib/uploads.sh
. "$ICI/../lib/uploads.sh"

ECHECS=0
verifier() {
  if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  ÉCHEC $3 — attendu « $2 », obtenu « $1 »"; ECHECS=$((ECHECS + 1)); fi
}

# Empreinte d'un dossier : chemins relatifs et sommes de contrôle, triés.
empreinte() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) | sha256sum | cut -c1-16; }

nouveau_depot() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/deploy/images-suivies/produits"
  printf 'suivie' > "$d/deploy/images-suivies/produits/suivie.png"
  echo "$d"
}

echo "1. rien à déplacer"
D="$(nouveau_depot)"
deplacer_uploads "$D" >/dev/null
verifier "$(find "$D/donnees/uploads" -type f | wc -l)" "1" "seule l'image suivie est recopiée"
verifier "$([ -e "$D/public" ] && echo oui || echo non)" "non" "pas de dossier public créé"

echo "2. déplacement des images vers un dossier neuf"
D="$(nouveau_depot)"
mkdir -p "$D/public/uploads/produits"
for i in 1 2 3; do head -c 2048 /dev/urandom > "$D/public/uploads/produits/image-$i.png"; done
AVANT="$(empreinte "$D/public/uploads")"
deplacer_uploads "$D" >/dev/null
verifier "$([ -e "$D/public" ] && echo oui || echo non)" "non" "public/ supprimé une fois vide"
verifier "$(find "$D/donnees/uploads" -type f | wc -l)" "4" "trois images déplacées, plus l'image suivie"
rm "$D/donnees/uploads/produits/suivie.png"
verifier "$(empreinte "$D/donnees/uploads")" "$AVANT" "contenu identique, octet pour octet"

echo "3. les deux dossiers sont pleins : refus, rien ne bouge"
D="$(nouveau_depot)"
mkdir -p "$D/public/uploads/produits" "$D/donnees/uploads/produits"
printf 'ancien' > "$D/public/uploads/produits/a.png"
printf 'nouveau' > "$D/donnees/uploads/produits/b.png"
AVANT_P="$(empreinte "$D/public/uploads")"; AVANT_D="$(empreinte "$D/donnees/uploads")"
if deplacer_uploads "$D" >/dev/null 2>&1; then CODE=0; else CODE=$?; fi
verifier "$([ "$CODE" -ne 0 ] && echo refus || echo accepte)" "refus" "code de sortie non nul"
verifier "$(empreinte "$D/public/uploads")$(empreinte "$D/donnees/uploads")" "${AVANT_P}${AVANT_D}" "aucun fichier modifié"

echo "4. relancé après coup : même résultat"
D="$(nouveau_depot)"
mkdir -p "$D/public/uploads/produits"
printf 'x' > "$D/public/uploads/produits/x.png"
deplacer_uploads "$D" >/dev/null
UNE="$(empreinte "$D/donnees/uploads")"
deplacer_uploads "$D" >/dev/null
verifier "$(empreinte "$D/donnees/uploads")" "$UNE" "seconde exécution sans effet"

echo "5. interrompu : public/uploads vide mais présent, donnees/uploads rempli"
D="$(nouveau_depot)"
mkdir -p "$D/public/uploads" "$D/donnees/uploads/produits"
printf 'y' > "$D/donnees/uploads/produits/y.png"
deplacer_uploads "$D" >/dev/null
verifier "$([ -e "$D/public" ] && echo oui || echo non)" "non" "reste vide nettoyé"
verifier "$(cat "$D/donnees/uploads/produits/y.png")" "y" "images existantes intactes"

echo "6. l'image suivie n'écrase jamais une image du même nom"
D="$(nouveau_depot)"
mkdir -p "$D/donnees/uploads/produits"
printf 'serveur' > "$D/donnees/uploads/produits/suivie.png"
deplacer_uploads "$D" >/dev/null
verifier "$(cat "$D/donnees/uploads/produits/suivie.png")" "serveur" "copie sans écrasement"

if [ "$ECHECS" -ne 0 ]; then
  echo "$ECHECS échec(s)."
  exit 1
fi
echo "Tous les cas passent."
