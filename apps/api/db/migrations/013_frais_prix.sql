-- ============================================================
-- MIGRATION 013 — Détail du coût de revient
-- Prix d'achat + frais libellés (transport, douane, stockage…) par
-- produit et par boutique ; prix_boutique.cout_revient en reste la
-- somme, lue telle quelle par les ventes, les marges et les rapports.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- 1. Types de frais, gérés par l'administrateur. Un type désactivé n'est
--    plus proposé mais reste sur les prix qui l'utilisent.
CREATE TABLE IF NOT EXISTS types_frais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  libelle TEXT NOT NULL UNIQUE,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO types_frais (libelle)
SELECT l FROM (VALUES ('Transport'), ('Douane'), ('Stockage'), ('Manutention')) AS t(l)
WHERE NOT EXISTS (SELECT 1 FROM types_frais WHERE libelle = t.l);

-- 2. Prix d'achat unitaire. NULL : coût de revient saisi d'un seul montant
--    (ou prix conseillé appliqué), sans détail.
ALTER TABLE prix_boutique ADD COLUMN IF NOT EXISTS prix_achat DECIMAL(12,2);

-- 3. Frais d'un prix : montant par unité, ou pourcentage du prix d'achat.
CREATE TABLE IF NOT EXISTS frais_prix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL,
  boutique_id UUID NOT NULL,
  type_frais_id UUID NOT NULL REFERENCES types_frais(id),
  mode TEXT NOT NULL CHECK (mode IN ('montant', 'pourcentage')),
  valeur DECIMAL(12,2) NOT NULL CHECK (valeur >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (produit_id, boutique_id) REFERENCES prix_boutique(produit_id, boutique_id) ON DELETE CASCADE,
  UNIQUE (produit_id, boutique_id, type_frais_id)
);

CREATE INDEX IF NOT EXISTS idx_frais_prix_type ON frais_prix(type_frais_id);
