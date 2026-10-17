import pg from "pg";

// pg renvoie NUMERIC (montants) et BIGINT (COUNT) en chaînes, pour ne rien perdre
// en précision. Ici les montants sont des numeric(12,2) et les comptages petits :
// un nombre JavaScript les représente exactement, et les fronts reçoivent des
// nombres. Réglage global du module pg, posé une fois au chargement de l'API.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valeur) => Number(valeur));
pg.types.setTypeParser(pg.types.builtins.INT8, (valeur) => Number(valeur));
