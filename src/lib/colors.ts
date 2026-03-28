// Mapping des nuances politiques vers des couleurs
// Source: nomenclature officielle du Ministère de l'Intérieur
const NUANCE_COLORS: Record<string, string> = {
  // Extrême gauche
  LEXG: '#8B0000',
  LCOM: '#D00000',
  LFI:  '#CC2443',

  // Gauche
  LSOC: '#E8555A',
  LDVG: '#F08080',
  LUG:  '#DC3545',
  LRDG: '#E87070',
  LVEC: '#2ECC40',
  LECO: '#55C855',

  // Centre
  LREM: '#FFD600',
  LMDM: '#FF8C00',
  LUDI: '#00A0D6',
  LDVC: '#6CBDDF',
  LUC:  '#F5C518',
  LHORI: '#FF8C00',

  // Droite
  LLR:  '#0057B8',
  LDVD: '#4A90C4',
  LUD:  '#003D8F',

  // Extrême droite
  LRN:  '#0A2463',
  LREC: '#3A3A8C',
  LEXD: '#2C2C54',

  // Divers
  LDIV: '#808080',
  LAUT: '#A0A0A0',

  // Nuances 2020 (nomenclature antérieure)
  NC:   '#a3b18a',  // Non Classé / Sans étiquette
  LNC:  '#a3b18a',  // Non Communiqué
  LGJ:  '#f5dd42',  // Gilets Jaunes
  LDLF: '#003366',  // Debout La France
  LREG: '#9370DB',  // Régionaliste

  // Nuances européennes 2024
  LENS: '#FFD600',  // Ensemble (Macron)
}

// Couleur pour les communes sans étiquette politique — distinct du gris dimmed
const DEFAULT_COLOR = '#a3b18a'

export function getNuanceColor(nuance: string): string {
  return NUANCE_COLORS[nuance] ?? DEFAULT_COLOR
}

export function getNuanceLabel(nuance: string): string {
  const labels: Record<string, string> = {
    LEXG: 'Extrême gauche',
    LCOM: 'Parti communiste',
    LFI:  'La France insoumise',
    LSOC: 'Parti socialiste',
    LDVG: 'Divers gauche',
    LUG:  'Union de la gauche',
    LRDG: 'Parti radical de gauche',
    LVEC: 'Les Écologistes',
    LECO: 'Écologiste',
    LREM: 'Renaissance',
    LMDM: 'MoDem',
    LUDI: 'Union des démocrates et indépendants',
    LDVC: 'Divers centre',
    LUC:  'Union du centre',
    LHORI: 'Horizons',
    LLR:  'Les Républicains',
    LDVD: 'Divers droite',
    LUD:  'Union de la droite',
    LRN:  'Rassemblement national',
    LREC: 'Reconquête',
    LEXD: 'Extrême droite',
    LDIV: 'Divers',
    LAUT: 'Autres',
    NC:   'Sans étiquette',
    LNC:  'Sans étiquette',
    LGJ:  'Gilets Jaunes',
    LDLF: 'Debout La France',
    LREG: 'Régionaliste',
    LENS: 'Ensemble',
  }
  return labels[nuance] ?? (nuance || 'Sans étiquette')
}

// Dégradé pour le taux de participation (du rouge au vert)
export function getParticipationColor(pourcentage: number): string {
  // Clamp entre 0 et 100
  const p = Math.max(0, Math.min(100, pourcentage))

  if (p < 40) {
    // Rouge foncé → rouge
    const t = p / 40
    const r = Math.round(139 + t * (220 - 139))
    const g = Math.round(0 + t * 50)
    const b = Math.round(0 + t * 50)
    return `rgb(${r},${g},${b})`
  }
  if (p < 60) {
    // Rouge → orange → jaune
    const t = (p - 40) / 20
    const r = Math.round(220 + t * (255 - 220))
    const g = Math.round(50 + t * (200 - 50))
    const b = Math.round(50 - t * 50)
    return `rgb(${r},${g},${b})`
  }
  if (p < 75) {
    // Jaune → vert clair
    const t = (p - 60) / 15
    const r = Math.round(255 - t * (255 - 100))
    const g = Math.round(200 + t * (180 - 200))
    const b = Math.round(0 + t * 50)
    return `rgb(${r},${g},${b})`
  }
  // Vert clair → vert foncé
  const t = (p - 75) / 25
  const r = Math.round(100 - t * 70)
  const g = Math.round(180 + t * (140 - 180))
  const b = Math.round(50 + t * 30)
  return `rgb(${r},${g},${b})`
}

/**
 * Gradient color for a party's score in a commune.
 * Interpolates from near-white to the party's full color based on pourcentage (0–60+).
 */
export function getPartyScoreColor(nuance: string, pourcentage: number): string {
  const hex = NUANCE_COLORS[nuance] ?? DEFAULT_COLOR
  const r0 = parseInt(hex.slice(1, 3), 16)
  const g0 = parseInt(hex.slice(3, 5), 16)
  const b0 = parseInt(hex.slice(5, 7), 16)

  // Clamp 0–60 → 0–1 (most commune scores are 0–60%, saturate above)
  const t = Math.min(1, Math.max(0, pourcentage / 55))

  // Interpolate from near-white (240,240,240) to the party color
  const r = Math.round(240 + t * (r0 - 240))
  const g = Math.round(240 + t * (g0 - 240))
  const b = Math.round(240 + t * (b0 - 240))
  return `rgb(${r},${g},${b})`
}

export { NUANCE_COLORS }
