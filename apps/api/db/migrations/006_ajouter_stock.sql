-- ============================================================
-- MIGRATION 006 — AJOUT DE STOCK ATOMIQUE (réceptions, réapprovisionnement)
-- ============================================================

CREATE OR REPLACE FUNCTION public.ajouter_stock(
  p_produit_id uuid,
  p_boutique_id uuid,
  p_quantite integer
) RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
  v_quantite_avant INTEGER;
BEGIN
  IF p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  INSERT INTO stocks (produit_id, boutique_id, quantite, quantite_reservee, updated_at)
  VALUES (p_produit_id, p_boutique_id, p_quantite, 0, NOW())
  ON CONFLICT (produit_id, boutique_id)
  DO UPDATE SET quantite = stocks.quantite + p_quantite, updated_at = NOW()
  RETURNING quantite - p_quantite INTO v_quantite_avant;

  RETURN TRUE;
END;
$function$;