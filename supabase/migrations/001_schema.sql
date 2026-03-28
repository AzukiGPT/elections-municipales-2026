-- Elections France - Database Schema
-- Supabase project: elections-france (aozlegtymbxoiqitiunu)

-- ============================================================
-- 1. Reference tables
-- ============================================================

CREATE TABLE elections (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,          -- 'municipales', 'europeennes'
  annee INT NOT NULL,          -- 2020, 2024, 2026
  tour INT,                    -- 1, 2 (NULL for europeennes)
  date_scrutin DATE,
  description TEXT,
  UNIQUE(type, annee, tour)
);

CREATE TABLE nuances (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  couleur TEXT,                -- hex color code
  famille TEXT                 -- 'extreme_gauche', 'gauche', 'centre', 'droite', 'extreme_droite', 'divers'
);

CREATE TABLE departements (
  code TEXT PRIMARY KEY,       -- '01', '2A', '75', '971'...
  libelle TEXT NOT NULL,
  code_region TEXT
);

CREATE TABLE communes (
  code TEXT PRIMARY KEY,            -- '01001', '75101'...
  libelle TEXT NOT NULL,
  code_departement TEXT NOT NULL REFERENCES departements(code),
  is_arrondissement BOOLEAN DEFAULT false,
  code_commune_parent TEXT           -- '75056' for Paris arrondissements
);

CREATE INDEX idx_communes_dept ON communes(code_departement);

-- ============================================================
-- 2. Results tables
-- ============================================================

CREATE TABLE resultats_vote (
  id SERIAL PRIMARY KEY,
  election_id INT NOT NULL REFERENCES elections(id),
  code_commune TEXT NOT NULL REFERENCES communes(code),
  inscrits INT NOT NULL,
  votants INT NOT NULL,
  abstentions INT NOT NULL,
  exprimes INT NOT NULL,
  blancs INT NOT NULL,
  nuls INT NOT NULL,
  UNIQUE(election_id, code_commune)
);

CREATE INDEX idx_resultats_election ON resultats_vote(election_id);
CREATE INDEX idx_resultats_commune ON resultats_vote(code_commune);

CREATE TABLE candidatures (
  id SERIAL PRIMARY KEY,
  election_id INT NOT NULL REFERENCES elections(id),
  code_commune TEXT NOT NULL REFERENCES communes(code),
  numero_panneau INT,
  nom TEXT,
  prenom TEXT,
  sexe TEXT,                         -- 'M', 'F'
  nuance TEXT NOT NULL,
  libelle_liste TEXT,
  libelle_abrege TEXT,
  voix INT NOT NULL,
  pct_inscrits NUMERIC(6,2),
  pct_exprimes NUMERIC(6,2),
  elu BOOLEAN DEFAULT false,
  sieges_cm INT,                     -- sièges conseil municipal
  sieges_cc INT,                     -- sièges conseil communautaire
  sieges INT                         -- sièges (PLM / européennes)
);

CREATE INDEX idx_candidatures_election ON candidatures(election_id);
CREATE INDEX idx_candidatures_commune ON candidatures(code_commune);
CREATE INDEX idx_candidatures_nuance ON candidatures(nuance);
CREATE INDEX idx_candidatures_election_commune ON candidatures(election_id, code_commune);

-- ============================================================
-- 3. Elected officials
-- ============================================================

CREATE TABLE elus (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  sexe TEXT,
  date_naissance DATE,
  code_commune TEXT,
  code_departement TEXT,
  mandat_type TEXT,                   -- 'maire', 'conseiller_municipal', 'conseiller_arrondissement', etc.
  date_debut_mandat DATE,
  date_debut_fonction DATE,
  csp_code TEXT,
  csp_libelle TEXT,
  nuance TEXT,
  sortant BOOLEAN,
  election_tour TEXT                  -- 'élu T1', 'élu T2'
);

CREATE INDEX idx_elus_commune ON elus(code_commune);
CREATE INDEX idx_elus_dept ON elus(code_departement);
CREATE INDEX idx_elus_mandat ON elus(mandat_type);

-- ============================================================
-- 4. Row Level Security (public read)
-- ============================================================

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultats_vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE elus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_elections" ON elections FOR SELECT USING (true);
CREATE POLICY "public_read_nuances" ON nuances FOR SELECT USING (true);
CREATE POLICY "public_read_departements" ON departements FOR SELECT USING (true);
CREATE POLICY "public_read_communes" ON communes FOR SELECT USING (true);
CREATE POLICY "public_read_resultats" ON resultats_vote FOR SELECT USING (true);
CREATE POLICY "public_read_candidatures" ON candidatures FOR SELECT USING (true);
CREATE POLICY "public_read_elus" ON elus FOR SELECT USING (true);

-- ============================================================
-- 5. Seed: Elections reference data
-- ============================================================

INSERT INTO elections (type, annee, tour, date_scrutin, description) VALUES
  ('municipales', 2020, 1, '2020-03-15', 'Municipales 2020 - 1er tour'),
  ('municipales', 2020, 2, '2020-06-28', 'Municipales 2020 - 2nd tour'),
  ('europeennes', 2024, NULL, '2024-06-09', 'Européennes 2024'),
  ('municipales', 2026, 1, '2026-03-15', 'Municipales 2026 - 1er tour'),
  ('municipales', 2026, 2, '2026-03-22', 'Municipales 2026 - 2nd tour');

-- ============================================================
-- 6. Seed: Nuances reference data
-- ============================================================

INSERT INTO nuances (code, label, couleur, famille) VALUES
  ('LEXG', 'Extrême gauche', '#8B0000', 'extreme_gauche'),
  ('LCOM', 'Parti communiste', '#D00000', 'extreme_gauche'),
  ('LFI', 'La France insoumise', '#CC2443', 'gauche'),
  ('LSOC', 'Parti socialiste', '#E8555A', 'gauche'),
  ('LDVG', 'Divers gauche', '#F08080', 'gauche'),
  ('LUG', 'Union de la gauche', '#DC3545', 'gauche'),
  ('LRDG', 'Parti radical de gauche', '#E87070', 'gauche'),
  ('LVEC', 'Les Écologistes', '#2ECC40', 'gauche'),
  ('LECO', 'Écologiste', '#55C855', 'gauche'),
  ('LREM', 'Renaissance', '#FFD600', 'centre'),
  ('LMDM', 'MoDem', '#FF8C00', 'centre'),
  ('LUDI', 'Union des démocrates et indépendants', '#00A0D6', 'centre'),
  ('LDVC', 'Divers centre', '#6CBDDF', 'centre'),
  ('LUC', 'Union du centre', '#F5C518', 'centre'),
  ('LHORI', 'Horizons', '#FF8C00', 'centre'),
  ('LENS', 'Ensemble', '#FFD600', 'centre'),
  ('LLR', 'Les Républicains', '#0057B8', 'droite'),
  ('LDVD', 'Divers droite', '#4A90C4', 'droite'),
  ('LUD', 'Union de la droite', '#003D8F', 'droite'),
  ('LRN', 'Rassemblement national', '#0A2463', 'extreme_droite'),
  ('LREC', 'Reconquête', '#3A3A8C', 'extreme_droite'),
  ('LEXD', 'Extrême droite', '#2C2C54', 'extreme_droite'),
  ('LDIV', 'Divers', '#808080', 'divers'),
  ('LAUT', 'Autres', '#A0A0A0', 'divers')
ON CONFLICT (code) DO NOTHING;
