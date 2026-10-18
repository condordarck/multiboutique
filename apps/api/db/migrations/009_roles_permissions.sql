-- ============================================================
-- 009_roles_permissions.sql
-- Permissions configurables par rôle (page admin /admin/roles)
-- Le magasinier (gerant_stock) perd la modification de stock :
-- il ne peut que consulter stock + produits.
-- ============================================================

CREATE TABLE IF NOT EXISTS roles_permissions (
  role       text NOT NULL,
  permission text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (role, permission)
);

-- Grille de départ (reprend les droits existants + nouvelles permissions crédits)
-- gerant_stock : LECTURE SEULE du stock (stock:genere retiré)

INSERT INTO roles_permissions (role, permission)
SELECT 'proprietaire', p.x FROM unnest(ARRAY[
  'ventes:voir','ventes:creer','ventes:annuler',
  'reservations:voir','reservations:gerer',
  'stock:voir','stock:gerer',
  'produits:voir','produits:gerer',
  'prix:gerer','rapports:voir',
  'promos:voir','promos:gerer',
  'clients:voir','clients:gerer',
  'commandes:voir','commandes:gerer',
  'achats:voir','achats:gerer',
  'consolidation:voir',
  'prix_conseilles:voir','prix_conseilles:gerer',
  'credits:voir','credits:gerer'
]) AS p(x) ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role, permission)
SELECT 'gerant', p.x FROM unnest(ARRAY[
  'ventes:voir','ventes:creer','ventes:annuler',
  'reservations:voir','reservations:gerer',
  'stock:voir','stock:gerer',
  'produits:voir','produits:gerer',
  'prix:gerer','rapports:voir',
  'promos:voir','promos:gerer',
  'clients:voir','clients:gerer',
  'commandes:voir','commandes:gerer',
  'achats:voir','achats:gerer',
  'consolidation:voir',
  'prix_conseilles:voir',
  'credits:voir','credits:gerer'
]) AS p(x) ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role, permission)
SELECT 'directeur_groupe', p.x FROM unnest(ARRAY[
  'ventes:voir','reservations:voir','stock:voir','produits:voir',
  'rapports:voir','promos:voir','clients:voir','commandes:voir',
  'achats:voir','consolidation:voir','prix_conseilles:voir','credits:voir'
]) AS p(x) ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role, permission)
SELECT 'directeur_region', p.x FROM unnest(ARRAY[
  'ventes:voir','reservations:voir','stock:voir','produits:voir',
  'rapports:voir','promos:voir','clients:voir','commandes:voir',
  'achats:voir','consolidation:voir','prix_conseilles:voir','credits:voir'
]) AS p(x) ON CONFLICT DO NOTHING;

-- Magasinier : consultation uniquement (plus de modification de stock)
INSERT INTO roles_permissions (role, permission)
SELECT 'gerant_stock', p.x FROM unnest(ARRAY[
  'stock:voir','produits:voir'
]) AS p(x) ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role, permission)
SELECT 'comptable', p.x FROM unnest(ARRAY[
  'ventes:voir','reservations:voir','stock:voir','produits:voir',
  'rapports:voir','promos:voir','clients:voir','commandes:voir',
  'achats:voir','consolidation:voir','prix_conseilles:voir',
  'credits:voir','credits:gerer'
]) AS p(x) ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role, permission)
SELECT 'vendeur', p.x FROM unnest(ARRAY[
  'ventes:voir','ventes:creer','stock:voir','produits:voir'
]) AS p(x) ON CONFLICT DO NOTHING;

-- client et administrateur : aucune permission opérationnelle