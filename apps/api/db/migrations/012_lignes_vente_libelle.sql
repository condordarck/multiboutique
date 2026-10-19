-- Nom et code du produit figés dans la ligne de vente : un produit renommé
-- ne réécrit pas les reçus des ventes passées. NULL (ligne écrite par une
-- version antérieure de l'API) : la lecture retombe sur le produit.
ALTER TABLE lignes_vente ADD COLUMN IF NOT EXISTS produit_nom TEXT;
ALTER TABLE lignes_vente ADD COLUMN IF NOT EXISTS produit_code TEXT;

UPDATE lignes_vente l
SET produit_nom = p.nom, produit_code = p.code
FROM produits p
WHERE p.id = l.produit_id AND l.produit_nom IS NULL;
