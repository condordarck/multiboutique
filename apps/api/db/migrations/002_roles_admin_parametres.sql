-- ============================================================
-- MIGRATION 002 — Rôle administrateur, paramètres, client
-- Applique les changements du schéma v3 à une base v2 existante.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- 1. Nouveau rôle 'administrateur' (exécuté hors transaction)
ALTER TYPE role_utilisateur ADD VALUE IF NOT EXISTS 'administrateur';

-- 2. Table des paramètres généraux
CREATE TABLE IF NOT EXISTS parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Lier les réservations à un compte client (optionnel)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS utilisateur_id UUID REFERENCES utilisateurs(id);
CREATE INDEX IF NOT EXISTS idx_reservations_utilisateur ON reservations(utilisateur_id);

-- 4. Bascule du compte admin vers le rôle administrateur (configuration uniquement)
UPDATE utilisateurs
SET role = 'administrateur'
WHERE email = 'admin@multiboutique.com' AND role = 'proprietaire';

-- 5. Création d'un compte propriétaire dédié s'il n'existe pas
INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, telephone, actif)
SELECT 'proprietaire@multiboutique.com', crypt('proprietaire123', gen_salt('bf', 10)), 'Propriétaire', 'proprietaire', '{}', '+243 000 000 000', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'proprietaire@multiboutique.com');

-- 6. Paramètres par défaut
INSERT INTO parametres (cle, valeur, description) VALUES
  ('monnaie', '$', 'Symbole monétaire affiché dans l''application'),
  ('nom_application', 'MultiBoutique', 'Nom de l''application'),
  ('seuil_alerte_defaut', '10', 'Seuil d''alerte stock par défaut pour les nouveaux produits')
ON CONFLICT (cle) DO NOTHING;