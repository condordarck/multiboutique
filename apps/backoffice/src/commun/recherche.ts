// Recherche tolérante : ni la casse ni les accents ne comptent
// (« huile darachide » trouve « Huile d'arachide »).
function normaliser(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .trim();
}

export function correspond(nom: string, recherche: string) {
  return normaliser(nom).includes(normaliser(recherche));
}
