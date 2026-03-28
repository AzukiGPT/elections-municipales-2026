-- Views for frontend queries

-- Aggregated department summary per election
CREATE OR REPLACE VIEW dept_summary AS
SELECT
  rv.election_id,
  com.code_departement,
  dep.libelle AS libelle_departement,
  SUM(rv.inscrits) AS inscrits,
  SUM(rv.votants) AS votants,
  ROUND(SUM(rv.votants)::numeric / NULLIF(SUM(rv.inscrits), 0) * 100, 2) AS pourcentage_votants,
  COUNT(DISTINCT rv.code_commune) AS commune_count
FROM resultats_vote rv
JOIN communes com ON rv.code_commune = com.code
JOIN departements dep ON com.code_departement = dep.code
WHERE com.is_arrondissement = false
  OR com.code LIKE '%SR%'
GROUP BY rv.election_id, com.code_departement, dep.libelle;

-- Party stats per election
CREATE OR REPLACE VIEW party_stats AS
SELECT
  c.election_id,
  c.nuance,
  COUNT(DISTINCT c.code_commune) AS communes_presentes,
  ROUND(AVG(c.pct_exprimes)::numeric, 2) AS score_moyen,
  SUM(c.voix) AS total_voix,
  SUM(COALESCE(c.sieges_cm, 0) + COALESCE(c.sieges, 0)) AS total_sieges
FROM candidatures c
GROUP BY c.election_id, c.nuance;

-- Dominant nuance per department (the party with most total votes)
CREATE OR REPLACE VIEW dept_dominant_nuance AS
SELECT DISTINCT ON (election_id, code_departement)
  sub.election_id,
  sub.code_departement,
  sub.nuance AS nuance_dominante
FROM (
  SELECT
    c.election_id,
    com.code_departement,
    c.nuance,
    SUM(c.voix) AS total_voix
  FROM candidatures c
  JOIN communes com ON c.code_commune = com.code
  WHERE c.nuance != ''
  GROUP BY c.election_id, com.code_departement, c.nuance
) sub
ORDER BY sub.election_id, sub.code_departement, sub.total_voix DESC;

-- Party wins count per election (communes where a party has the most votes)
CREATE OR REPLACE VIEW party_wins AS
SELECT
  w.election_id,
  w.nuance,
  COUNT(*) AS communes_gagnees
FROM (
  SELECT DISTINCT ON (election_id, code_commune)
    election_id, code_commune, nuance
  FROM candidatures
  WHERE nuance != ''
  ORDER BY election_id, code_commune, voix DESC
) w
GROUP BY w.election_id, w.nuance;

-- RLS policies for views
ALTER VIEW dept_summary OWNER TO postgres;
ALTER VIEW party_stats OWNER TO postgres;
ALTER VIEW dept_dominant_nuance OWNER TO postgres;
ALTER VIEW party_wins OWNER TO postgres;

-- Grant access
GRANT SELECT ON dept_summary TO anon, authenticated;
GRANT SELECT ON party_stats TO anon, authenticated;
GRANT SELECT ON dept_dominant_nuance TO anon, authenticated;
GRANT SELECT ON party_wins TO anon, authenticated;
