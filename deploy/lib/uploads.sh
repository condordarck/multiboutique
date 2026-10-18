#!/usr/bin/env bash
# Déplacement des images de public/uploads (monolithe) vers donnees/uploads.
# Sourcé par deploy/server-deploy.sh ; testé par deploy/test/deplacer-uploads.test.sh.

# Vrai si le dossier existe et contient au moins un fichier (les dossiers vides
# ne comptent pas : ils sont le reste d'un déplacement interrompu).
contient_des_fichiers() {
  [ -d "$1" ] && [ -n "$(find "$1" -type f -print -quit)" ]
}

# deplacer_uploads <racine du dépôt>
#
# Idempotent. Refuse (code 1, sans rien modifier) si l'ancien ET le nouveau
# dossier contiennent des fichiers : fusionner deux jeux d'images est une
# décision humaine. Recopie ensuite les images suivies par Git
# (deploy/images-suivies) sans jamais écraser une image du serveur.
deplacer_uploads() {
  local racine="$1"
  local ancien="$racine/public/uploads"
  local nouveau="$racine/donnees/uploads"

  if contient_des_fichiers "$ancien"; then
    if contient_des_fichiers "$nouveau"; then
      echo "[uploads] ERREUR : $ancien et $nouveau contiennent tous deux des images ; rien n'est déplacé." >&2
      return 1
    fi
    mkdir -p "$racine/donnees"
    # Un nouveau dossier sans fichier peut exister (interruption) : on le remplace.
    rm -rf "$nouveau"
    # Même système de fichiers : mv est un renommage, atomique.
    mv "$ancien" "$nouveau"
    echo "[uploads] Images déplacées : $ancien → $nouveau"
  fi

  # Restes vides de l'ancien emplacement (aucun fichier : rien à perdre).
  if [ -d "$ancien" ] && ! contient_des_fichiers "$ancien"; then
    rm -rf "$ancien"
  fi
  [ -d "$racine/public" ] && rmdir --ignore-fail-on-non-empty "$racine/public"

  mkdir -p "$nouveau"
  if [ -d "$racine/deploy/images-suivies" ]; then
    cp -rn "$racine/deploy/images-suivies/." "$nouveau/"
  fi
  return 0
}
