#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Téléchargement des données ==="

# 1. CSV des résultats par commune
echo ">> Résultats par commune (13.6 Mo)..."
curl -sL -o "$PROJECT_DIR/data/resultats-communes.csv" \
  "https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260316-160646/municipales-2026-resultats-communes-2026-03-16.csv"

# 2. CSV des résultats PLM (arrondissements Paris/Lyon/Marseille)
echo ">> Résultats PLM..."
curl -sL -o "$PROJECT_DIR/data/resultats-plm.csv" \
  "https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260316-160627/conseils-darrondissement-paris-lyon-marseille-2026-resultats-secteurs-2026-03-16.csv"

# 3. GeoJSON départements (source: etalab, résolution 100m)
echo ">> GeoJSON départements..."
curl -sL -o "$PROJECT_DIR/data/departements-raw.json" \
  "https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/departements-100m.geojson"

# 4. GeoJSON communes par département via geo.api.gouv.fr
echo ">> GeoJSON communes par département..."
DEPS="01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 21 22 23 24 25 26 27 28 29 2A 2B 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 87 88 89 90 91 92 93 94 95 971 972 973 974 976"

mkdir -p "$PROJECT_DIR/data/communes-geo"
for dep in $DEPS; do
  echo "   département $dep..."
  curl -sL -o "$PROJECT_DIR/data/communes-geo/${dep}.json" \
    "https://geo.api.gouv.fr/departements/${dep}/communes?format=geojson&geometry=contour"
done

echo "=== Téléchargement terminé ==="
echo "Résultats:"
ls -lh "$PROJECT_DIR/data/resultats-communes.csv"
ls -lh "$PROJECT_DIR/data/departements-raw.json"
echo "Communes GeoJSON:"
ls "$PROJECT_DIR/data/communes-geo/" | wc -l
