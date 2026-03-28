import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(__dirname, '..')
const DATA_DIR = join(PROJECT_DIR, 'data')
const PUBLIC_GEO = join(PROJECT_DIR, 'public', 'geo')
const PUBLIC_DATA = join(PROJECT_DIR, 'public', 'data')

// ─── Helpers ──────────────────────────────────────────────

function parsePercentage(val) {
  if (!val) return 0
  return parseFloat(val.replace(',', '.').replace('%', '')) || 0
}

function parseIntSafe(val) {
  if (!val) return 0
  return parseInt(val, 10) || 0
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ';' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── Parse CSV ────────────────────────────────────────────

function parseResultsCsv(filePath) {
  console.log(`Parsing ${filePath}...`)
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = parseCsvLine(lines[0])

  const communes = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < 10) continue

    const get = (name) => {
      const idx = headers.indexOf(name)
      return idx >= 0 ? values[idx] : ''
    }

    const candidats = []
    for (let n = 1; n <= 13; n++) {
      const voix = get(`Voix ${n}`)
      if (!voix) break

      candidats.push({
        numero: n,
        nuance: get(`Nuance liste ${n}`) || '',
        libelleAbrege: get(`Libellé abrégé de liste ${n}`) || '',
        libelleListe: get(`Libellé de liste ${n}`) || '',
        voix: parseIntSafe(voix),
        pourcentageExprimes: parsePercentage(get(`% Voix/exprimés ${n}`)),
        elu: get(`Elu ${n}`) === 'OUI',
        siegesCM: parseIntSafe(get(`Sièges au CM ${n}`)),
      })
    }

    communes.push({
      codeDepartement: get('Code département'),
      codeCommune: get('Code commune'),
      libelleCommune: get('Libellé commune'),
      inscrits: parseIntSafe(get('Inscrits')),
      votants: parseIntSafe(get('Votants')),
      pourcentageVotants: parsePercentage(get('% Votants')),
      abstentions: parseIntSafe(get('Abstentions')),
      exprimes: parseIntSafe(get('Exprimés')),
      blancs: parseIntSafe(get('Blancs')),
      nuls: parseIntSafe(get('Nuls')),
      candidats,
    })
  }

  console.log(`  → ${communes.length} communes parsées`)
  return communes
}

// ─── Agrégation par département ───────────────────────────

function aggregateByDepartement(communes) {
  const deptMap = new Map()

  for (const c of communes) {
    const dep = c.codeDepartement
    if (!deptMap.has(dep)) {
      deptMap.set(dep, {
        codeDepartement: dep,
        libelleDepartement: '',
        inscrits: 0,
        votants: 0,
        communeCount: 0,
        nuanceVoix: new Map(),
      })
    }
    const d = deptMap.get(dep)
    d.inscrits += c.inscrits
    d.votants += c.votants
    d.communeCount++

    // Compter les voix par nuance pour trouver la dominante
    // Ignorer les listes sans nuance politique
    for (const cand of c.candidats) {
      if (!cand.nuance) continue
      const current = d.nuanceVoix.get(cand.nuance) || 0
      d.nuanceVoix.set(cand.nuance, current + cand.voix)
    }
  }

  const result = []
  for (const [, d] of deptMap) {
    // Trouver la nuance avec le plus de voix
    let maxVoix = 0
    let nuanceDominante = ''
    for (const [nuance, voix] of d.nuanceVoix) {
      if (voix > maxVoix) {
        maxVoix = voix
        nuanceDominante = nuance
      }
    }

    result.push({
      codeDepartement: d.codeDepartement,
      libelleDepartement: d.libelleDepartement,
      inscrits: d.inscrits,
      votants: d.votants,
      pourcentageVotants: d.inscrits > 0 ? Math.round((d.votants / d.inscrits) * 10000) / 100 : 0,
      nuanceDominante,
      communeCount: d.communeCount,
    })
  }

  return result
}

// ─── Simplifier GeoJSON départements ──────────────────────

function simplifyDepartements() {
  console.log('Simplifying departements GeoJSON...')
  const raw = JSON.parse(readFileSync(join(DATA_DIR, 'departements-raw.json'), 'utf-8'))

  // Filtrer DOM-TOM lointains pour la carte métropole (garder Corse, DROM proches)
  const metroAndDrom = new Set([
    ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')),
    '2A', '2B', '971', '972', '973', '974', '976'
  ])

  const simplified = {
    type: 'FeatureCollection',
    features: raw.features
      .filter(f => metroAndDrom.has(f.properties.code))
      .map(f => ({
        type: 'Feature',
        properties: {
          code: f.properties.code,
          nom: f.properties.nom,
        },
        geometry: f.geometry,
      })),
  }

  console.log(`  → ${simplified.features.length} départements`)
  return simplified
}

// ─── Copier et simplifier GeoJSON communes ────────────────

function processCommunesGeo() {
  console.log('Processing communes GeoJSON by department...')
  const geoDir = join(DATA_DIR, 'communes-geo')
  const outDir = join(PUBLIC_GEO, 'communes')
  mkdirSync(outDir, { recursive: true })

  const files = readdirSync(geoDir).filter(f => f.endsWith('.json'))
  let totalFeatures = 0

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(geoDir, file), 'utf-8'))
    const simplified = {
      type: 'FeatureCollection',
      features: raw.features.map(f => ({
        type: 'Feature',
        properties: {
          code: f.properties.code,
          nom: f.properties.nom,
          codeDepartement: f.properties.codeDepartement,
        },
        geometry: f.geometry,
      })),
    }
    totalFeatures += simplified.features.length
    writeFileSync(join(outDir, file), JSON.stringify(simplified))
  }

  console.log(`  → ${files.length} fichiers, ${totalFeatures} communes total`)
}

// ─── Main ─────────────────────────────────────────────────

function main() {
  mkdirSync(join(PUBLIC_DATA, 'communes'), { recursive: true })
  mkdirSync(join(PUBLIC_GEO, 'communes'), { recursive: true })

  // 1. Parse CSV résultats
  const communes = parseResultsCsv(join(DATA_DIR, 'resultats-communes.csv'))

  // 2. Agréger par département
  const departements = aggregateByDepartement(communes)

  // Enrichir les libellés des départements depuis le GeoJSON
  const deptGeo = JSON.parse(readFileSync(join(DATA_DIR, 'departements-raw.json'), 'utf-8'))
  const deptNames = new Map()
  for (const f of deptGeo.features) {
    deptNames.set(f.properties.code, f.properties.nom)
  }
  for (const d of departements) {
    d.libelleDepartement = deptNames.get(d.codeDepartement) || d.codeDepartement
  }

  // 3. Écrire les JSON agrégés
  writeFileSync(
    join(PUBLIC_DATA, 'departements.json'),
    JSON.stringify(departements)
  )
  console.log(`Écrit: departements.json (${departements.length} départements)`)

  // 4. Écrire les résultats par commune, groupés par département
  const communesByDept = new Map()
  for (const c of communes) {
    const dep = c.codeDepartement
    if (!communesByDept.has(dep)) communesByDept.set(dep, [])
    communesByDept.get(dep).push(c)
  }

  for (const [dep, communeList] of communesByDept) {
    writeFileSync(
      join(PUBLIC_DATA, 'communes', `${dep}.json`),
      JSON.stringify(communeList)
    )
  }
  console.log(`Écrit: ${communesByDept.size} fichiers communes`)

  // 5. Stats nationales
  const national = {
    totalInscrits: communes.reduce((s, c) => s + c.inscrits, 0),
    totalVotants: communes.reduce((s, c) => s + c.votants, 0),
    totalCommunes: communes.length,
    totalDepartements: departements.length,
    pourcentageVotants: 0,
  }
  national.pourcentageVotants = Math.round((national.totalVotants / national.totalInscrits) * 10000) / 100
  writeFileSync(join(PUBLIC_DATA, 'national.json'), JSON.stringify(national))
  console.log(`Stats nationales: ${national.totalCommunes} communes, ${national.pourcentageVotants}% participation`)

  // 6. GeoJSON départements simplifié pour public/
  const deptSimplified = simplifyDepartements()
  writeFileSync(join(PUBLIC_GEO, 'departements.json'), JSON.stringify(deptSimplified))
  console.log(`GeoJSON départements: ${deptSimplified.features.length} features`)

  // 7. Communes GeoJSON par département
  processCommunesGeo()

  // 8. Index de recherche (code, nom, dep, depNom)
  const searchIndex = communes.map(c => ({
    code: c.codeCommune,
    nom: c.libelleCommune,
    dep: c.codeDepartement,
    depNom: deptNames.get(c.codeDepartement) || c.codeDepartement,
  }))
  searchIndex.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  writeFileSync(join(PUBLIC_DATA, 'search-index.json'), JSON.stringify(searchIndex))
  console.log(`Index de recherche: ${searchIndex.length} communes`)

  // 9. Résultats PLM (arrondissements Paris/Lyon/Marseille)
  parsePlmResults(join(DATA_DIR, 'resultats-plm.csv'), deptNames)

  console.log('\n=== Pipeline terminé ===')
}

// ─── Parse PLM CSV ────────────────────────────────────────

function parsePlmResults(filePath, deptNames) {
  console.log(`Parsing PLM: ${filePath}...`)
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = parseCsvLine(lines[0])

  const secteurs = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < 10) continue

    const get = (name) => {
      const idx = headers.indexOf(name)
      return idx >= 0 ? values[idx] : ''
    }

    const candidats = []
    for (let n = 1; n <= 11; n++) {
      const voix = get(`Voix ${n}`)
      if (!voix) break

      candidats.push({
        numero: n,
        nuance: get(`Nuance liste ${n}`) || '',
        libelleAbrege: get(`Libellé abrégé de liste ${n}`) || '',
        libelleListe: get(`Libellé de liste ${n}`) || '',
        voix: parseIntSafe(voix),
        pourcentageExprimes: parsePercentage(get(`% Voix/exprimés ${n}`)),
        elu: false,
        siegesCM: parseIntSafe(get(`Sièges ${n}`)),
      })
    }

    const codeSecteur = get('Code secteur')
    const codeDep = get('Code département')

    secteurs.push({
      codeDepartement: codeDep,
      codeCommune: codeSecteur,
      libelleCommune: get('Libellé secteur'),
      inscrits: parseIntSafe(get('Inscrits')),
      votants: parseIntSafe(get('Votants')),
      pourcentageVotants: parsePercentage(get('% Votants')),
      abstentions: parseIntSafe(get('Abstentions')),
      exprimes: parseIntSafe(get('Exprimés')),
      blancs: parseIntSafe(get('Blancs')),
      nuls: parseIntSafe(get('Nuls')),
      candidats,
    })
  }

  console.log(`  → ${secteurs.length} secteurs PLM parsés`)

  // Normalize sector codes to match GeoJSON arrondissement codes
  // Paris: 75056SRxx → 751xx (sector 1 covers arr 1-4, sectors 5-20 are 1:1)
  // Lyon: 69123SRxx → 693(80+xx)
  // Marseille: 13055SRxx → pairs of 132xx (8 sectors for 16 arrondissements)
  const MARSEILLE_SECTOR_TO_ARR = {
    '01': ['13201', '13207'],
    '02': ['13202', '13203'],
    '03': ['13204', '13205'],
    '04': ['13206', '13208'],
    '05': ['13209', '13210'],
    '06': ['13211', '13212'],
    '07': ['13213', '13214'],
    '08': ['13215', '13216'],
  }

  function sectorToGeoCodes(codeSecteur, codeDep) {
    const sectorNum = codeSecteur.replace(/.*SR/, '')
    if (codeDep === '75') {
      // Sector 1 covers arrondissements 1-4
      if (sectorNum === '01') return ['75101', '75102', '75103', '75104']
      return [`751${sectorNum}`]
    }
    if (codeDep === '69') {
      return [`69${380 + parseInt(sectorNum, 10)}`]
    }
    if (codeDep === '13') {
      return MARSEILLE_SECTOR_TO_ARR[sectorNum] || []
    }
    return [codeSecteur]
  }

  // Expand sectors into entries matching GeoJSON codes
  const expanded = []
  for (const s of secteurs) {
    const geoCodes = sectorToGeoCodes(s.codeCommune, s.codeDepartement)
    for (const geoCode of geoCodes) {
      expanded.push({
        ...s,
        codeCommune: geoCode,
        sectorCode: s.codeCommune,
      })
    }
  }

  // Group by city dep and write
  const byCityDep = new Map()
  for (const s of expanded) {
    const dep = s.codeDepartement
    if (!byCityDep.has(dep)) byCityDep.set(dep, [])
    byCityDep.get(dep).push(s)
  }

  for (const [dep, sectorList] of byCityDep) {
    writeFileSync(
      join(PUBLIC_DATA, 'communes', `plm-${dep}.json`),
      JSON.stringify(sectorList)
    )
  }
  console.log(`  → ${byCityDep.size} fichiers PLM écrits (${expanded.length} entrées)`)

  // Add PLM secteurs to search index (use original sectors, not expanded)
  const plmSearchEntries = secteurs.map(s => ({
    code: s.codeCommune,
    nom: s.libelleCommune,
    dep: s.codeDepartement,
    depNom: deptNames.get(s.codeDepartement) || s.codeDepartement,
    plm: true,
  }))

  // Append to existing search index
  const existingIndex = JSON.parse(readFileSync(join(PUBLIC_DATA, 'search-index.json'), 'utf-8'))
  const combined = [...existingIndex, ...plmSearchEntries]
  combined.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  writeFileSync(join(PUBLIC_DATA, 'search-index.json'), JSON.stringify(combined))
  console.log(`  → Index de recherche mis à jour: ${combined.length} entrées`)
}

main()
