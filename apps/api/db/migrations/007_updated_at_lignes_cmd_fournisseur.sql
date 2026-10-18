-- 007_updated_at_lignes_cmd_fournisseur.sql
-- Complète le schéma de lignes_cmd_fournisseur (manquait updated_at).

ALTER TABLE lignes_cmd_fournisseur ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();