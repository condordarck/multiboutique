-- Données des parcours de bout en bout, ajoutées au seed (3 boutiques,
-- administrateur, propriétaire). Mots de passe connus, hachés comme en production.
INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, actif) VALUES
  ('gerant@e2e.test',  crypt('gerant-e2e',  gen_salt('bf', 4)), 'Awa Gérante',  'gerant',  '{11111111-1111-1111-1111-111111111111}', true),
  ('vendeur@e2e.test', crypt('vendeur-e2e', gen_salt('bf', 4)), 'Koffi Vendeur', 'vendeur', '{11111111-1111-1111-1111-111111111111}', true),
  ('client@e2e.test',  crypt('client-e2e',  gen_salt('bf', 4)), 'Client Vitrine', 'client', '{}', true);

INSERT INTO produits (id, reference, nom) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'E2E-RIZ',    'Riz 25 kg'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'E2E-HUILE',  'Huile d''arachide 1 L'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'E2E-SUCRE',  'Sucre 1 kg');

INSERT INTO prix_boutique (produit_id, boutique_id, prix_vente, cout_revient) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 22, 18),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 3.2, 2.5),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 1.5, 1),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 23, 18);

INSERT INTO stocks (produit_id, boutique_id, quantite, seuil_alerte) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 40, 5),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 25, 10),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 60, 20),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 5, 5);
