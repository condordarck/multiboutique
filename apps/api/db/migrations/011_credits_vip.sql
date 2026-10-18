-- Clients VIP
ALTER TABLE clients ADD COLUMN IF NOT EXISTS est_vip BOOLEAN NOT NULL DEFAULT false;

-- Vente liée à un client + paiement partiel (reste = créance)
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS montant_paye DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Registre des créances (journal des ventes à crédit, versements et annulations)
CREATE TABLE IF NOT EXISTS registre_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  vente_id UUID REFERENCES ventes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('vente', 'versement', 'annulation')),
  libelle TEXT NOT NULL,
  -- montant > 0 : dette contractée (vente) ; montant < 0 : dette réduite (versement / annulation)
  montant DECIMAL(12,2) NOT NULL,
  solde_apres DECIMAL(12,2) NOT NULL,
  auteur_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registre_credits_client ON registre_credits (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registre_credits_boutique ON registre_credits (boutique_id, created_at DESC);

-- Délai de relance (jours) au-delà duquel un client en cours est considéré à relancer
INSERT INTO parametres (cle, valeur)
VALUES ('relance_delai_jours', '30')
ON CONFLICT (cle) DO NOTHING;