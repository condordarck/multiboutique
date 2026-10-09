-- ============================================================
-- 010_produits_code.sql
-- Code produit "nomenclature" (SKU) lisible et scannable.
--   produits.code  = PREFIXE-CATÉGORIE-0001 (ex. EPI-0003, HYG-0002, PRD-0012)
--   categories.code = 3 lettres sans accents (HYG, EPI, BOI…)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Colonne des catégories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS code TEXT;

-- Codes courts pour les catégories existantes
WITH base AS (
  SELECT id,
         UPPER(LEFT(regexp_replace(unaccent(COALESCE(nom, '')), '[^A-Za-z]', '', 'g'), 3)) AS prefix
  FROM categories
),
numbered AS (
  SELECT id, prefix, row_number() OVER (PARTITION BY prefix ORDER BY id) AS rn
  FROM base
)
UPDATE categories c
SET code = CASE WHEN numbered.rn = 1 THEN numbered.prefix
                ELSE numbered.prefix || chr((64 + numbered.rn)::int) END
FROM numbered
WHERE c.id = numbered.id;

-- Colonne des produits
ALTER TABLE produits ADD COLUMN IF NOT EXISTS code TEXT;

-- Génération des codes existants (numérotation par préfixe de catégorie)
WITH base AS (
  SELECT p.id,
         COALESCE(c.code, 'PRD') AS prefix
  FROM produits p
  LEFT JOIN categories c ON c.id = p.categorie_id
),
seq AS (
  SELECT id, prefix || '-' || LPAD(row_number() OVER (PARTITION BY prefix ORDER BY id)::text, 4, '0') AS code
  FROM base
)
UPDATE produits p SET code = seq.code
FROM seq
WHERE p.id = seq.id;

-- Contraintes d'unicité
ALTER TABLE categories ADD CONSTRAINT categories_code_key UNIQUE (code);
ALTER TABLE produits ADD CONSTRAINT produits_code_key UNIQUE (code);