-- ============================================================
-- MIGRATION 005 — STRUCTURE DE GRANDE TAILLE
-- Groupes / Régions / Directeurs, Clients grossistes, Commandes B2B,
-- Achats fournisseurs, Prix conseillés (gouvernance siège)
-- PostgreSQL 16, extension uuid-ossp disponible
-- ============================================================

-- ---- Organigramme : groupes (siège) + régions ----
CREATE TABLE IF NOT EXISTS groupes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  groupe_id UUID NOT NULL REFERENCES groupes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boutiques ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_boutiques_region ON boutiques(region_id);

-- ---- Nouveaux profils (siège) ----
ALTER TYPE role_utilisateur ADD VALUE IF NOT EXISTS 'directeur_region';
ALTER TYPE role_utilisateur ADD VALUE IF NOT EXISTS 'directeur_groupe';

ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS groupe_id UUID REFERENCES groupes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_utilisateurs_region ON utilisateurs(region_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_groupe ON utilisateurs(groupe_id);

-- ---- Clients (grossistes / détaillants) ----
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  type_client TEXT NOT NULL DEFAULT 'grossiste' CHECK (type_client IN ('grossiste', 'detaillant')),
  plafond_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  encours DECIMAL(12,2) NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_boutique ON clients(boutique_id);

-- ---- Commandes B2B (bons de commande grossistes) ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_commande') THEN
    CREATE TYPE statut_commande AS ENUM ('en_attente', 'confirmee', 'livree', 'annulee');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_commande TEXT NOT NULL UNIQUE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  statut statut_commande DEFAULT 'en_attente',
  montant_brut DECIMAL(12,2) NOT NULL DEFAULT 0,
  remise DECIMAL(12,2) NOT NULL DEFAULT 0,
  montant_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  code_promo_id UUID REFERENCES codes_promo(id) ON DELETE SET NULL,
  terme_paiement TEXT NOT NULL DEFAULT 'comptant' CHECK (terme_paiement IN ('comptant', 'credit')),
  note TEXT,
  validee_par UUID REFERENCES utilisateurs(id),
  date_livraison TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commandes_boutique ON commandes(boutique_id);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);

CREATE TABLE IF NOT EXISTS lignes_commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lignes_commandes_cmd ON lignes_commandes(commande_id);

-- Lien vente <- commande (traçabilité)
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS commande_id UUID REFERENCES commandes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ventes_commande ON ventes(commande_id);

-- ---- Fournisseurs & commandes d'achat ----
CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_boutique ON fournisseurs(boutique_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_cmd_fournisseur') THEN
    CREATE TYPE statut_cmd_fournisseur AS ENUM ('en_attente', 'partielle', 'recue', 'annulee');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS commandes_fournisseur (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_cmd TEXT NOT NULL UNIQUE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id),
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  statut statut_cmd_fournisseur DEFAULT 'en_attente',
  total_attendu DECIMAL(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmd_four_boutique ON commandes_fournisseur(boutique_id);
CREATE INDEX IF NOT EXISTS idx_cmd_four_fournisseur ON commandes_fournisseur(fournisseur_id);

CREATE TABLE IF NOT EXISTS lignes_cmd_fournisseur (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID NOT NULL REFERENCES commandes_fournisseur(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite_commandee INTEGER NOT NULL CHECK (quantite_commandee > 0),
  quantite_recue INTEGER NOT NULL DEFAULT 0,
  prix_unitaire DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lignes_cmd_four ON lignes_cmd_fournisseur(commande_id);

-- ---- Prix conseillés (publiés par le siège, applicables par boutique) ----
CREATE TABLE IF NOT EXISTS prix_reference (
  produit_id UUID PRIMARY KEY REFERENCES produits(id) ON DELETE CASCADE,
  prix_vente DECIMAL(12,2) NOT NULL,
  cout_revient DECIMAL(12,2),
  actif BOOLEAN DEFAULT true,
  created_by UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (prix_vente >= 0)
);