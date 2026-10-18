#!/usr/bin/env bash
# Déplacement des images de public/uploads (monolithe) vers donnees/uploads.
# Sourcé par deploy/server-deploy.sh ; testé par deploy/test/deplacer-uploads.test.sh.

# Vrai si le dossier existe et contient autre chose que des dossiers (fichier,
# lien...) ; les dossiers vides ne comptent pas : ils sont le reste d'un
# déplacement interrompu, ou recréés par Docker pour un montage.
contient_des_fichiers() {
  [ -d "$1" ] && [ -n "$(find "$1" -mindepth 1 ! -type d -print -quit)" ]
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

  # Restes vides de l'ancien emplacement (aucun fichier : rien à perdre). Recréés
  # par Docker, ils appartiennent à root et résistent : sans gravité ici,
  # server-deploy.sh les retire après l'arrêt du monolithe.
  if [ -d "$ancien" ] && ! contient_des_fichiers "$ancien"; then
    rm -rf "$ancien" 2>/dev/null || true
  fi
  if [ -d "$racine/public" ]; then
    rmdir --ignore-fail-on-non-empty "$racine/public" 2>/dev/null || true
  fi

  mkdir -p "$nouveau"
  # Copie sans écrasement, fichier par fichier : `cp -n` sort en erreur sur un
  # fichier existant avec coreutils 9.2 à 9.4 (Ubuntu 24.04).
  local source relatif
  if [ -d "$racine/deploy/images-suivies" ]; then
    while IFS= read -r -d '' source; do
      relatif="${source#"$racine/deploy/images-suivies/"}"
      if [ ! -e "$nouveau/$relatif" ]; then
        mkdir -p "$(dirname "$nouveau/$relatif")"
        cp -p "$source" "$nouveau/$relatif"
      fi
    done < <(find "$racine/deploy/images-suivies" -type f -print0)
  fi
  return 0
}
