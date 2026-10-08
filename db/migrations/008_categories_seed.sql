-- 008_categories_seed.sql
-- Catégories de base type supermarché + rattachement des produits existants.
-- Idempotent : n'insère que les catégories absentes et ne rattache que les produits sans catégorie.

INSERT INTO categories (nom, description)
SELECT 'Hygiène & Entretien', 'Détergents, savons, javellisants et produits ménagers'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE nom = 'Hygiène & Entretien');

INSERT INTO categories (nom, description)
SELECT 'Épicerie & Pâtes', 'Riz, huiles, pâtes, spaghettis et produits secs'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE nom = 'Épicerie & Pâtes');

INSERT INTO categories (nom, description)
SELECT 'Boissons', 'Eaux, jus, boissons gazeuses et autres'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE nom = 'Boissons');

-- Rattachement des produits existants (par référence, sans écraser un lien déjà posé)
UPDATE produits SET categorie_id = c.id, updated_at = NOW()
FROM categories c
WHERE produits.categorie_id IS NULL
  AND (
    (produits.reference IN ('KLIN', 'VIVA') AND c.nom = 'Hygiène & Entretien')
    OR (produits.reference = 'IDOMMIE' AND c.nom = 'Épicerie & Pâtes')
  );