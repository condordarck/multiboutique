-- ============================================================
-- MIGRATION 003 — Codes promo (grossistes) + remises
-- Ajoute les codes promotionnels et le support des remises
-- sur les ventes.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- 1. Table des codes promo
CREATE TABLE IF NOT EXISTS codes_promo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  type_reduction TEXT NOT NULL CHECK (type_reduction IN ('pourcentage', 'montant')),
  valeur_reduction NUMERIC(12,2) NOT NULL,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  max_utilisations INTEGER,
  nombre_utilisations INTEGER NOT NULL DEFAULT 0,
  date_debut DATE,
  date_fin DATE,
  actif BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codes_promo_boutique ON codes_promo(boutique_id);
CREATE INDEX IF NOT EXISTS idx_codes_promo_code ON codes_promo(code);

-- 2. Remise portée sur la vente + lien vers le code promo utilisé
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS code_promo_id UUID REFERENCES codes_promo(id);
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS remise NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ventes_code_promo ON ventes(code_promo_id);