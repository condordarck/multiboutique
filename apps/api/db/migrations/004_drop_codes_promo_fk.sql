-- Relax FK on ventes.code_promo_id so deleting a code preserves historique ventes
ALTER TABLE ventes
  DROP CONSTRAINT IF EXISTS ventes_code_promo_id_fkey,
  ADD CONSTRAINT ventes_code_promo_id_fkey
    FOREIGN KEY (code_promo_id) REFERENCES codes_promo(id)
    ON DELETE SET NULL;