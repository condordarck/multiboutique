-- ============================================================
-- MIGRATION 014 — Modification des commandes passées
-- Deux permissions, données au gérant pour le moment :
--   commandes:modifier : commande client (B2B) avant livraison ;
--   achats:modifier    : commande fournisseur tant que rien n'est reçu.
-- Attribuables aux autres rôles dans /admin/roles.
-- Les conditions de la remise (type, valeur) sont figées sur la commande :
-- une modification la recalcule selon ses conditions d'origine, même si le
-- code promo a été changé ou supprimé depuis.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

INSERT INTO roles_permissions (role, permission)
SELECT 'gerant', p.x FROM unnest(ARRAY['commandes:modifier', 'achats:modifier']) AS p(x)
ON CONFLICT DO NOTHING;

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS remise_type TEXT CHECK (remise_type IN ('pourcentage', 'montant'));
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS remise_valeur DECIMAL(12,2);

-- Commandes existantes : conditions actuelles du code, à défaut de mieux.
UPDATE commandes c
SET remise_type = cp.type_reduction, remise_valeur = cp.valeur_reduction
FROM codes_promo cp
WHERE cp.id = c.code_promo_id AND c.remise_type IS NULL;
