-- ============================================================
-- SCHÉMA INITIAL — Application Multi-Boutiques
-- PostgreSQL pur (aucune dépendance externe)
-- Version: 3.0 (auto-hébergé, RBAC admin + client)
-- ============================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE role_utilisateur AS ENUM (
  'administrateur',
  'proprietaire',
  'gerant',
  'gerant_stock',
  'comptable',
  'vendeur',
  'client'
);

CREATE TYPE type_mouvement_stock AS ENUM (
  'entree',
  'sortie',
  'ajustement',
  'transfert'
);

CREATE TYPE statut_reservation AS ENUM (
  'en_attente',
  'prete',
  'payee',
  'retiree',
  'annulee'
);

CREATE TYPE statut_vente AS ENUM (
  'validee',
  'annulee',
  'corrigee'
);

CREATE TYPE mode_paiement AS ENUM (
  'especes',
  'mobile_money',
  'carte',
  'autre'
);

-- ============================================================
-- 2. TABLES PRINCIPALES
-- ============================================================

-- ---- BOUTIQUES ----
CREATE TABLE boutiques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- UTILISATEURS ----
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nom_complet TEXT NOT NULL,
  role role_utilisateur NOT NULL DEFAULT 'client',
  boutique_ids UUID[] DEFAULT '{}',
  telephone TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- CATÉGORIES DE PRODUITS ----
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- PRODUITS (catalogue global) ----
CREATE TABLE produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  description TEXT,
  categorie_id UUID REFERENCES categories(id),
  image_url TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- PRIX PAR BOUTIQUE (un produit a un prix différent par boutique) ----
CREATE TABLE prix_boutique (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  prix_vente DECIMAL(12,2) NOT NULL,
  cout_revient DECIMAL(12,2),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produit_id, boutique_id)
);

-- ---- STOCK PAR BOUTIQUE ----
CREATE TABLE stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL DEFAULT 0,
  quantite_reservee INTEGER NOT NULL DEFAULT 0,
  seuil_alerte INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produit_id, boutique_id),
  CHECK (quantite >= 0),
  CHECK (quantite_reservee >= 0),
  CHECK (quantite >= quantite_reservee)
);

-- ---- MOUVEMENTS DE STOCK ----
CREATE TABLE mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES produits(id),
  boutique_id UUID NOT NULL REFERENCES boutiques(id),
  type type_mouvement_stock NOT NULL,
  quantite INTEGER NOT NULL,
  quantite_avant INTEGER NOT NULL,
  quantite_apres INTEGER NOT NULL,
  motif TEXT,
  boutique_destination_id UUID REFERENCES boutiques(id),
  auteur_id UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- VENTES EN BOUTIQUE ----
CREATE TABLE ventes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_vente TEXT NOT NULL UNIQUE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id),
  vendeur_id UUID NOT NULL REFERENCES utilisateurs(id),
  mode_paiement mode_paiement DEFAULT 'especes',
  montant_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  statut statut_vente DEFAULT 'validee',
  motif_annulation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- LIGNES DE VENTE ----
CREATE TABLE lignes_vente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vente_id UUID NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire DECIMAL(12,2) NOT NULL,
  cout_unitaire DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- PARAMÈTRES GÉNÉRAUX (config du système, gérés par l'administrateur) ----
CREATE TABLE parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- RÉSERVATIONS EN LIGNE ----
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_reservation TEXT NOT NULL UNIQUE,
  utilisateur_id UUID REFERENCES utilisateurs(id),
  client_nom TEXT NOT NULL,
  client_telephone TEXT NOT NULL,
  client_email TEXT,
  boutique_id UUID NOT NULL REFERENCES boutiques(id),
  statut statut_reservation DEFAULT 'en_attente',
  montant_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_retrait_prevue DATE,
  date_retrait_reelle TIMESTAMPTZ,
  validee_par UUID REFERENCES utilisateurs(id),
  motif_annulation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- LIGNES DE RÉSERVATION ----
CREATE TABLE lignes_reservation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- JOURNAL D'AUDIT (immuable) ----
CREATE TABLE journal_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES utilisateurs(id),
  boutique_id UUID REFERENCES boutiques(id),
  action TEXT NOT NULL,
  entite TEXT NOT NULL,
  entite_id UUID,
  valeur_avant JSONB,
  valeur_apres JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEX
-- ============================================================

CREATE INDEX idx_prix_boutique_produit ON prix_boutique(produit_id);
CREATE INDEX idx_prix_boutique_boutique ON prix_boutique(boutique_id);
CREATE INDEX idx_stocks_boutique ON stocks(boutique_id);
CREATE INDEX idx_stocks_produit ON stocks(produit_id);
CREATE INDEX idx_mouvements_boutique ON mouvements_stock(boutique_id);
CREATE INDEX idx_mouvements_date ON mouvements_stock(created_at);
CREATE INDEX idx_ventes_boutique ON ventes(boutique_id);
CREATE INDEX idx_ventes_date ON ventes(created_at);
CREATE INDEX idx_ventes_statut ON ventes(statut);
CREATE INDEX idx_lignes_vente_vente ON lignes_vente(vente_id);
CREATE INDEX idx_reservations_boutique ON reservations(boutique_id);
CREATE INDEX idx_reservations_utilisateur ON reservations(utilisateur_id);
CREATE INDEX idx_reservations_statut ON reservations(statut);
CREATE INDEX idx_lignes_reservation_reservation ON lignes_reservation(reservation_id);
CREATE INDEX idx_journal_audit_boutique ON journal_audit(boutique_id);
CREATE INDEX idx_journal_audit_date ON journal_audit(created_at);
CREATE INDEX idx_journal_audit_entite ON journal_audit(entite, entite_id);
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);

-- ============================================================
-- 4. FONCTIONS RPC (atomiques)
-- ============================================================

-- Fonction pour déduire le stock de manière atomique
CREATE OR REPLACE FUNCTION deduire_stock(
  p_produit_id UUID,
  p_boutique_id UUID,
  p_quantite INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_stock_actuel INTEGER;
  v_stock_reserve INTEGER;
BEGIN
  SELECT quantite, quantite_reservee INTO v_stock_actuel, v_stock_reserve
  FROM stocks
  WHERE produit_id = p_produit_id AND boutique_id = p_boutique_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock non trouvé pour ce produit dans cette boutique';
  END IF;

  IF (v_stock_actuel - v_stock_reserve) < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible: %, Demandé: %',
      (v_stock_actuel - v_stock_reserve), p_quantite;
  END IF;

  UPDATE stocks
  SET quantite = quantite - p_quantite,
      updated_at = NOW()
  WHERE produit_id = p_produit_id AND boutique_id = p_boutique_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour réserver du stock (réservation en ligne)
CREATE OR REPLACE FUNCTION reserver_stock(
  p_produit_id UUID,
  p_boutique_id UUID,
  p_quantite INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_stock_actuel INTEGER;
  v_stock_reserve INTEGER;
BEGIN
  SELECT quantite, quantite_reservee INTO v_stock_actuel, v_stock_reserve
  FROM stocks
  WHERE produit_id = p_produit_id AND boutique_id = p_boutique_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock non trouvé';
  END IF;

  IF (v_stock_actuel - v_stock_reserve) < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant pour réservation';
  END IF;

  UPDATE stocks
  SET quantite_reservee = quantite_reservee + p_quantite,
      updated_at = NOW()
  WHERE produit_id = p_produit_id AND boutique_id = p_boutique_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider une réservation (déduction définitive + libération réservation)
CREATE OR REPLACE FUNCTION valider_reservation(
  p_reservation_id UUID,
  p_validateur_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_ligne RECORD;
  v_boutique_id UUID;
BEGIN
  SELECT boutique_id INTO v_boutique_id FROM reservations WHERE id = p_reservation_id;
  IF v_boutique_id IS NULL THEN
    RAISE EXCEPTION 'Réservation non trouvée';
  END IF;

  -- Déduire le stock pour chaque ligne
  FOR v_ligne IN
    SELECT produit_id, quantite
    FROM lignes_reservation
    WHERE reservation_id = p_reservation_id
  LOOP
    UPDATE stocks
    SET quantite = quantite - v_ligne.quantite,
        quantite_reservee = quantite_reservee - v_ligne.quantite,
        updated_at = NOW()
    WHERE produit_id = v_ligne.produit_id
      AND boutique_id = v_boutique_id;
  END LOOP;

  -- Mettre à jour le statut
  UPDATE reservations
  SET statut = 'payee',
      validee_par = p_validateur_id,
      date_retrait_reelle = NOW(),
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. TRIGGERS — JOURNAL D'AUDIT AUTOMATIQUE
-- ============================================================

-- Fonction trigger pour journaliser les ventes
CREATE OR REPLACE FUNCTION log_audit_vente()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO journal_audit (auteur_id, boutique_id, action, entite, entite_id, valeur_apres)
    VALUES (NEW.vendeur_id, NEW.boutique_id, 'creation', 'vente', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO journal_audit (auteur_id, boutique_id, action, entite, entite_id, valeur_avant, valeur_apres)
    VALUES (NEW.vendeur_id, NEW.boutique_id, 'modification', 'vente', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_vente
  AFTER INSERT OR UPDATE ON ventes
  FOR EACH ROW EXECUTE FUNCTION log_audit_vente();

-- Fonction trigger pour journaliser les mouvements de stock
CREATE OR REPLACE FUNCTION log_audit_stock()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journal_audit (auteur_id, boutique_id, action, entite, entite_id, valeur_apres)
  VALUES (NEW.auteur_id, NEW.boutique_id, NEW.type::text, 'mouvement_stock', NEW.id, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_stock
  AFTER INSERT ON mouvements_stock
  FOR EACH ROW EXECUTE FUNCTION log_audit_stock();

-- ============================================================
-- 6. VUES UTILES
-- ============================================================

-- Vue : stock disponible par boutique
CREATE OR REPLACE VIEW stock_disponible AS
SELECT
  s.id,
  s.produit_id,
  s.boutique_id,
  p.nom AS produit_nom,
  p.reference AS produit_reference,
  b.nom AS boutique_nom,
  s.quantite,
  s.quantite_reservee,
  (s.quantite - s.quantite_reservee) AS disponible,
  s.seuil_alerte,
  CASE
    WHEN (s.quantite - s.quantite_reservee) <= 0 THEN 'rupture'
    WHEN (s.quantite - s.quantite_reservee) <= s.seuil_alerte THEN 'alerte'
    ELSE 'ok'
  END AS statut_stock,
  pb.prix_vente,
  pb.cout_revient
FROM stocks s
JOIN produits p ON p.id = s.produit_id
JOIN boutiques b ON b.id = s.boutique_id
LEFT JOIN prix_boutique pb ON pb.produit_id = s.produit_id AND pb.boutique_id = s.boutique_id;

-- Vue : ventes journalières par boutique
CREATE OR REPLACE VIEW ventes_journalieres AS
SELECT
  v.boutique_id,
  b.nom AS boutique_nom,
  DATE(v.created_at) AS date_vente,
  COUNT(*) AS nombre_ventes,
  SUM(v.montant_total) AS chiffre_affaires,
  v.mode_paiement
FROM ventes v
JOIN boutiques b ON b.id = v.boutique_id
WHERE v.statut = 'validee'
GROUP BY v.boutique_id, b.nom, DATE(v.created_at), v.mode_paiement;

-- Vue : résumé du jour par boutique (dashboard propriétaire)
CREATE OR REPLACE VIEW resume_jour AS
SELECT
  b.id AS boutique_id,
  b.nom AS boutique_nom,
  COALESCE(ventes_res.nombre_ventes, 0) AS nombre_ventes,
  COALESCE(ventes_res.chiffre_affaires, 0) AS chiffre_affaires,
  COALESCE(reservations_res.nombre_reservations, 0) AS nombre_reservations,
  COALESCE(reservations_res.montant_reservations, 0) AS montant_reservations,
  (SELECT COUNT(*) FROM stocks s WHERE s.boutique_id = b.id AND (s.quantite - s.quantite_reservee) <= s.seuil_alerte) AS alertes_stock,
  (SELECT COUNT(*) FROM reservations r WHERE r.boutique_id = b.id AND r.statut = 'en_attente') AS reservations_en_attente
FROM boutiques b
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS nombre_ventes, SUM(montant_total) AS chiffre_affaires
  FROM ventes WHERE boutique_id = b.id AND statut = 'validee' AND DATE(created_at) = CURRENT_DATE
) ventes_res ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS nombre_reservations, SUM(montant_total) AS montant_reservations
  FROM reservations WHERE boutique_id = b.id AND DATE(created_at) = CURRENT_DATE
) reservations_res ON true
WHERE b.statut = 'active';

-- ============================================================
-- 7. DONNÉES INITIALES (SEED)
-- ============================================================

-- Les 3 boutiques (UUID fixes pour référence simple)
INSERT INTO boutiques (id, nom, adresse, telephone, email, statut) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Boutique 1', 'Adresse boutique 1', '+243 000 000 001', 'boutique1@multiboutique.com', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Boutique 2', 'Adresse boutique 2', '+243 000 000 002', 'boutique2@multiboutique.com', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Boutique 3', 'Adresse boutique 3', '+243 000 000 003', 'boutique3@multiboutique.com', 'active');

-- Compte administrateur (configuration générale du système)
-- Email : admin@multiboutique.com | Mot de passe : admin123
INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, telephone, actif) VALUES
  ('admin@multiboutique.com', crypt('admin123', gen_salt('bf', 10)), 'Administrateur', 'administrateur', '{}', '+243 000 000 000', true);

-- Compte propriétaire (vue globale sur toutes les boutiques)
-- Email : proprietaire@multiboutique.com | Mot de passe : proprietaire123
INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, telephone, actif) VALUES
  ('proprietaire@multiboutique.com', crypt('proprietaire123', gen_salt('bf', 10)), 'Propriétaire', 'proprietaire', '{}', '+243 000 000 000', true);

-- Paramètres généraux par défaut
INSERT INTO parametres (cle, valeur, description) VALUES
  ('monnaie', '$', 'Symbole monétaire affiché dans l''application'),
  ('nom_application', 'MultiBoutique', 'Nom de l''application'),
  ('seuil_alerte_defaut', '10', 'Seuil d''alerte stock par défaut pour les nouveaux produits');