-- "Résultat final" elections: merged T1+T2 (uses T2 when available, T1 otherwise)
-- These are virtual elections that combine both rounds

-- Insert the merged elections
INSERT INTO elections (type, annee, tour, date_scrutin, description) VALUES
  ('municipales', 2026, NULL, '2026-03-22', 'Municipales 2026 - Résultat final'),
  ('municipales', 2020, NULL, '2020-06-28', 'Municipales 2020 - Résultat final')
ON CONFLICT (type, annee, tour) DO NOTHING;

-- Create a function to merge T1+T2 results for a given year
-- This copies T2 results where available, T1 results otherwise

-- For 2026: T1=election_id 4, T2=election_id 5
-- Merged will get the next available ID

-- We'll use a materialized approach: copy data into resultats_vote and candidatures
-- for the merged election IDs

-- Step 1: Get the merged election IDs
DO $$
DECLARE
  merged_2026_id INT;
  merged_2020_id INT;
  t1_2026_id INT := 4;
  t2_2026_id INT := 5;
  t1_2020_id INT := 1;
  t2_2020_id INT := 2;
BEGIN
  SELECT id INTO merged_2026_id FROM elections WHERE type='municipales' AND annee=2026 AND tour IS NULL;
  SELECT id INTO merged_2020_id FROM elections WHERE type='municipales' AND annee=2020 AND tour IS NULL;

  -- 2026 Final: Insert T2 results first (they take priority)
  INSERT INTO resultats_vote (election_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls)
  SELECT merged_2026_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls
  FROM resultats_vote
  WHERE election_id = t2_2026_id
  ON CONFLICT (election_id, code_commune) DO NOTHING;

  -- Then T1 results for communes NOT in T2
  INSERT INTO resultats_vote (election_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls)
  SELECT merged_2026_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls
  FROM resultats_vote
  WHERE election_id = t1_2026_id
    AND code_commune NOT IN (SELECT code_commune FROM resultats_vote WHERE election_id = t2_2026_id)
  ON CONFLICT (election_id, code_commune) DO NOTHING;

  -- 2026 Candidatures: T2 first
  INSERT INTO candidatures (election_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges)
  SELECT merged_2026_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges
  FROM candidatures
  WHERE election_id = t2_2026_id;

  -- Then T1 for communes NOT in T2
  INSERT INTO candidatures (election_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges)
  SELECT merged_2026_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges
  FROM candidatures
  WHERE election_id = t1_2026_id
    AND code_commune NOT IN (SELECT DISTINCT code_commune FROM candidatures WHERE election_id = t2_2026_id);

  -- 2020 Final: same logic
  INSERT INTO resultats_vote (election_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls)
  SELECT merged_2020_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls
  FROM resultats_vote
  WHERE election_id = t2_2020_id
  ON CONFLICT (election_id, code_commune) DO NOTHING;

  INSERT INTO resultats_vote (election_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls)
  SELECT merged_2020_id, code_commune, inscrits, votants, abstentions, exprimes, blancs, nuls
  FROM resultats_vote
  WHERE election_id = t1_2020_id
    AND code_commune NOT IN (SELECT code_commune FROM resultats_vote WHERE election_id = t2_2020_id)
  ON CONFLICT (election_id, code_commune) DO NOTHING;

  INSERT INTO candidatures (election_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges)
  SELECT merged_2020_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges
  FROM candidatures
  WHERE election_id = t2_2020_id;

  INSERT INTO candidatures (election_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges)
  SELECT merged_2020_id, code_commune, numero_panneau, nom, prenom, sexe, nuance, libelle_liste, libelle_abrege, voix, pct_inscrits, pct_exprimes, elu, sieges_cm, sieges_cc, sieges
  FROM candidatures
  WHERE election_id = t1_2020_id
    AND code_commune NOT IN (SELECT DISTINCT code_commune FROM candidatures WHERE election_id = t2_2020_id);

  RAISE NOTICE 'Merged elections created: 2026=%, 2020=%', merged_2026_id, merged_2020_id;
END $$;
