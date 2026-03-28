import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(__dirname, '..')
const DATA_DIR = join(PROJECT_DIR, 'data')
const DOWNLOADS_DIR = join(DATA_DIR, 'downloads')

// ─── Supabase client (service role for inserts) ──────────
const SUPABASE_URL = 'https://aozlegtymbxoiqitiunu.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Helpers ─────────────────────────────────────────────

function parsePercentage(val) {
  if (!val) return null
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

function parseCsvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = parseCsvLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < 5) continue
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }
  return rows
}

async function batchUpsert(table, data, batchSize = 500) {
  let inserted = 0
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    const { error } = await supabase.from(table).upsert(batch, { onConflict: undefined, ignoreDuplicates: true })
    if (error) {
      console.error(`  Error inserting into ${table} at batch ${i}:`, error.message)
      // Try one by one for this batch to skip duplicates
      for (const row of batch) {
        const { error: singleError } = await supabase.from(table).insert(row)
        if (singleError && !singleError.message.includes('duplicate')) {
          console.error(`    Row error:`, singleError.message)
        } else {
          inserted++
        }
      }
    } else {
      inserted += batch.length
    }
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= data.length) {
      console.log(`  ${table}: ${Math.min(i + batchSize, data.length)}/${data.length}`)
    }
  }
  console.log(`  → ${table}: ${inserted} rows inserted`)
  return inserted
}

async function batchInsert(table, data, batchSize = 500) {
  let inserted = 0
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`  Error inserting into ${table} at batch ${i}:`, error.message)
    } else {
      inserted += batch.length
    }
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= data.length) {
      console.log(`  ${table}: ${Math.min(i + batchSize, data.length)}/${data.length}`)
    }
  }
  console.log(`  → ${table}: ${inserted} rows inserted`)
  return inserted
}

// ─── Import departements ─────────────────────────────────

async function importDepartements() {
  console.log('\n=== Importing departements ===')
  const geo = JSON.parse(readFileSync(join(DATA_DIR, 'departements-raw.json'), 'utf-8'))
  const depts = geo.features.map(f => ({
    code: f.properties.code,
    libelle: f.properties.nom,
    code_region: f.properties.codeRegion || null,
  }))
  await batchUpsert('departements', depts)
}

// ─── Import communes ────────────────────────────────────

async function importCommunes() {
  console.log('\n=== Importing communes ===')
  // Build communes from existing T1 results CSV (has all communes)
  const rows = parseCsvFile(join(DATA_DIR, 'resultats-communes.csv'))
  const communeMap = new Map()

  for (const row of rows) {
    const code = row['Code commune']
    if (!code || communeMap.has(code)) continue
    communeMap.set(code, {
      code,
      libelle: row['Libellé commune'] || '',
      code_departement: row['Code département'],
      is_arrondissement: false,
      code_commune_parent: null,
    })
  }

  // Add PLM arrondissements from PLM CSV
  const plmRows = parseCsvFile(join(DATA_DIR, 'resultats-plm.csv'))
  const MARSEILLE_SECTOR_TO_ARR = {
    '01': ['13201', '13207'], '02': ['13202', '13203'],
    '03': ['13204', '13205'], '04': ['13206', '13208'],
    '05': ['13209', '13210'], '06': ['13211', '13212'],
    '07': ['13213', '13214'], '08': ['13215', '13216'],
  }

  for (const row of plmRows) {
    const codeSecteur = row['Code secteur']
    const codeDep = row['Code département']
    const sectorNum = codeSecteur.replace(/.*SR/, '')
    let geoCodes = []

    if (codeDep === '75') {
      geoCodes = sectorNum === '01'
        ? ['75101', '75102', '75103', '75104']
        : [`751${sectorNum}`]
    } else if (codeDep === '69') {
      geoCodes = [`69${380 + parseInt(sectorNum, 10)}`]
    } else if (codeDep === '13') {
      geoCodes = MARSEILLE_SECTOR_TO_ARR[sectorNum] || []
    }

    for (const geoCode of geoCodes) {
      if (!communeMap.has(geoCode)) {
        communeMap.set(geoCode, {
          code: geoCode,
          libelle: row['Libellé secteur'] || '',
          code_departement: codeDep,
          is_arrondissement: true,
          code_commune_parent: codeDep === '75' ? '75056' : codeDep === '69' ? '69123' : '13055',
        })
      }
    }
  }

  // Add PLM sector codes as communes (for resultats_vote FK)
  for (const row of plmRows) {
    const codeSecteur = row['Code secteur']
    const codeDep = row['Code département']
    if (!communeMap.has(codeSecteur)) {
      communeMap.set(codeSecteur, {
        code: codeSecteur,
        libelle: row['Libellé secteur'] || '',
        code_departement: codeDep,
        is_arrondissement: true,
        code_commune_parent: codeDep === '75' ? '75056' : codeDep === '69' ? '69123' : '13055',
      })
    }
  }

  // Also add communes from 2026 T2 that might not be in T1
  try {
    const t2Rows = parseCsvFile(join(DOWNLOADS_DIR, 'muni-2026-t2-communes.csv'))
    for (const row of t2Rows) {
      const code = row['Code commune']
      if (!code || communeMap.has(code)) continue
      communeMap.set(code, {
        code,
        libelle: row['Libellé commune'] || '',
        code_departement: row['Code département'],
        is_arrondissement: false,
        code_commune_parent: null,
      })
    }
  } catch { /* file may not exist yet */ }

  // Add communes from 2020 T1 (TSV, latin-1)
  try {
    const content2020 = readFileSync(join(DOWNLOADS_DIR, 'muni-2020-t1-1000plus.txt'), 'latin1')
    const lines2020 = content2020.split('\n').filter(l => l.trim())
    for (let i = 1; i < lines2020.length; i++) {
      const cols = lines2020[i].split('\t')
      if (cols.length < 4) continue
      const codeDep = cols[0].padStart(2, '0')
      const codeCommune = codeDep + cols[2].padStart(3, '0')
      if (communeMap.has(codeCommune)) continue
      communeMap.set(codeCommune, {
        code: codeCommune,
        libelle: cols[3] || '',
        code_departement: codeDep,
        is_arrondissement: false,
        code_commune_parent: null,
      })
    }
  } catch { /* file may not exist */ }

  // Add communes from européennes 2024
  try {
    const euroRows = parseCsvFile(join(DOWNLOADS_DIR, 'europeennes-2024-communes.csv'))
    for (const row of euroRows) {
      const code = row['Code commune']
      if (!code || communeMap.has(code)) continue
      communeMap.set(code, {
        code,
        libelle: row['Libellé commune'] || '',
        code_departement: row['Code département'],
        is_arrondissement: false,
        code_commune_parent: null,
      })
    }
  } catch { /* file may not exist */ }

  const communes = Array.from(communeMap.values())
  await batchUpsert('communes', communes)
}

// ─── Parse "wide" election results CSV ──────────────────

function parseWideResults(filePath, electionId, opts = {}) {
  const {
    communeCodeField = 'Code commune',
    communeLabel = 'Libellé commune',
    deptField = 'Code département',
    isSector = false,
    sectorField = 'Code secteur',
    maxCandidats = 13,
    hasSiegesCM = true,
    hasSiegesCC = true,
    hasSieges = false,
    hasElu = true,
    hasNom = true,
  } = opts

  const rows = parseCsvFile(filePath)
  const resultats = []
  const candidatures = []

  for (const row of rows) {
    const codeCommune = isSector ? row[sectorField] : row[communeCodeField]
    if (!codeCommune) continue

    resultats.push({
      election_id: electionId,
      code_commune: codeCommune,
      inscrits: parseIntSafe(row['Inscrits']),
      votants: parseIntSafe(row['Votants']),
      abstentions: parseIntSafe(row['Abstentions']),
      exprimes: parseIntSafe(row['Exprimés']),
      blancs: parseIntSafe(row['Blancs']),
      nuls: parseIntSafe(row['Nuls']),
    })

    for (let n = 1; n <= maxCandidats; n++) {
      const voix = row[`Voix ${n}`]
      if (!voix) break

      candidatures.push({
        election_id: electionId,
        code_commune: codeCommune,
        numero_panneau: parseIntSafe(row[`Numéro de panneau ${n}`]) || n,
        nom: hasNom ? (row[`Nom candidat ${n}`] || null) : null,
        prenom: hasNom ? (row[`Prénom candidat ${n}`] || null) : null,
        sexe: hasNom ? (row[`Sexe candidat ${n}`] || null) : null,
        nuance: row[`Nuance liste ${n}`] || row[`Nuance ${n}`] || '',
        libelle_liste: row[`Libellé de liste ${n}`] || null,
        libelle_abrege: row[`Libellé abrégé de liste ${n}`] || null,
        voix: parseIntSafe(voix),
        pct_inscrits: parsePercentage(row[`% Voix/inscrits ${n}`]),
        pct_exprimes: parsePercentage(row[`% Voix/exprimés ${n}`]),
        elu: hasElu ? (row[`Elu ${n}`] === 'OUI' || row[`Elu ${n}`] === 'Oui') : false,
        sieges_cm: hasSiegesCM ? parseIntSafe(row[`Sièges au CM ${n}`]) : null,
        sieges_cc: hasSiegesCC ? parseIntSafe(row[`Sièges au CC ${n}`]) : null,
        sieges: hasSieges ? parseIntSafe(row[`Sièges ${n}`]) : null,
      })
    }
  }

  return { resultats, candidatures }
}

// ─── Parse 2020 municipales (TSV, latin-1, different columns) ────

function parse2020Results(filePath, electionId) {
  const content = readFileSync(filePath, 'latin1')
  const lines = content.split('\n').filter(l => l.trim())
  // Detect separator: tab or semicolon
  const sep = lines[0].includes('\t') ? '\t' : ';'
  const resultats = []
  const candidatures = []
  const communesSeen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep)
    if (cols.length < 30) continue

    const codeDep = cols[0].padStart(2, '0')
    const codeCommune = codeDep + cols[2].padStart(3, '0')

    if (!communesSeen.has(codeCommune)) {
      communesSeen.add(codeCommune)
      resultats.push({
        election_id: electionId,
        code_commune: codeCommune,
        inscrits: parseIntSafe(cols[4]),
        votants: parseIntSafe(cols[7]),
        abstentions: parseIntSafe(cols[5]),
        exprimes: parseIntSafe(cols[15]),
        blancs: parseIntSafe(cols[9]),
        nuls: parseIntSafe(cols[12]),
      })
    }

    // Candidat blocks start at col 18 (0-indexed), each block = 12 cols
    // N.Pan, Code Nuance, Sexe, Nom, Prénom, Liste, Sièges/Elu, Sièges Secteur, Sièges CC, Voix, %Voix/Ins, %Voix/Exp
    for (let offset = 18; offset + 11 < cols.length; offset += 12) {
      const nuance = cols[offset + 1]
      const voix = cols[offset + 9]
      if (!nuance && !voix) break

      candidatures.push({
        election_id: electionId,
        code_commune: codeCommune,
        numero_panneau: parseIntSafe(cols[offset]) || null,
        nom: cols[offset + 3] || null,
        prenom: cols[offset + 4] || null,
        sexe: cols[offset + 2] || null,
        nuance: nuance || '',
        libelle_liste: cols[offset + 5] || null,
        libelle_abrege: null,
        voix: parseIntSafe(voix),
        pct_inscrits: parsePercentage(cols[offset + 10]),
        pct_exprimes: parsePercentage(cols[offset + 11]),
        elu: false,
        sieges_cm: parseIntSafe(cols[offset + 6]) || null,
        sieges_cc: parseIntSafe(cols[offset + 8]) || null,
        sieges: null,
      })
    }
  }

  return { resultats, candidatures }
}

// ─── Parse européennes (different column format) ────────

function parseEuropeennesResults(filePath, electionId) {
  const rows = parseCsvFile(filePath)
  const resultats = []
  const candidatures = []

  for (const row of rows) {
    const codeCommune = row['Code de la commune'] || row['Code commune']
    if (!codeCommune) continue

    resultats.push({
      election_id: electionId,
      code_commune: codeCommune,
      inscrits: parseIntSafe(row['Inscrits']),
      votants: parseIntSafe(row['Votants']),
      abstentions: parseIntSafe(row['Abstentions']),
      exprimes: parseIntSafe(row['Exprimés']),
      blancs: parseIntSafe(row['Blancs']),
      nuls: parseIntSafe(row['Nuls']),
    })

    for (let n = 1; n <= 38; n++) {
      const voix = row[`Voix ${n}`]
      if (!voix && !row[`Nuance liste ${n}`]) break

      const v = parseIntSafe(voix)
      if (v === 0 && !row[`Nuance liste ${n}`]) continue

      candidatures.push({
        election_id: electionId,
        code_commune: codeCommune,
        numero_panneau: parseIntSafe(row[`Numéro de panneau ${n}`]) || n,
        nom: null,
        prenom: null,
        sexe: null,
        nuance: row[`Nuance liste ${n}`] || '',
        libelle_liste: row[`Libellé de liste ${n}`] || null,
        libelle_abrege: row[`Libellé abrégé de liste ${n}`] || null,
        voix: v,
        pct_inscrits: parsePercentage(row[`% Voix/inscrits ${n}`]),
        pct_exprimes: parsePercentage(row[`% Voix/exprimés ${n}`]),
        elu: false,
        sieges_cm: null,
        sieges_cc: null,
        sieges: parseIntSafe(row[`Sièges ${n}`]) || null,
      })
    }
  }

  return { resultats, candidatures }
}

// ─── Import elus ────────────────────────────────────────

function convertFrDate(d) {
  if (!d) return null
  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  // French format DD/MM/YYYY
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseElusCsv(filePath, mandatType, opts = {}) {
  const rows = parseCsvFile(filePath)
  const elus = []

  for (const row of rows) {
    const nom = row['NOMPSN'] || row["Nom de l'élu"] || row['Nom'] || ''
    const prenom = row['PREPSN'] || row["Prénom de l'élu"] || row['Prénom'] || ''
    if (!nom) continue

    elus.push({
      nom,
      prenom,
      sexe: row['SEXPSN'] || row['Code sexe'] || null,
      date_naissance: convertFrDate(row['DATNAIPSN'] || row['Date de naissance']),
      code_commune: row['CODCOM'] || row['Code de la commune'] || null,
      code_departement: row['CODDPT'] || row['Code du département'] || null,
      mandat_type: mandatType,
      date_debut_mandat: convertFrDate(row['Date de début du mandat']),
      date_debut_fonction: convertFrDate(row['Date de début de la fonction']),
      csp_code: row['CODPRO'] || row['Code de la catégorie socio-professionnelle'] || null,
      csp_libelle: row['Libellé de la catégorie socio-professionnelle'] || null,
      nuance: row['CODE_NUANCE_DE_LISTE'] || row['CODE_NUA'] || null,
      sortant: row['SORTANT'] === 'True' || row['SORTANT'] === 'true' || null,
      election_tour: row['TOUR_ELECTION'] || opts.tour || null,
    })
  }

  return elus
}

// ─── Get election IDs ────────────────────────────────────

async function getElectionIds() {
  const { data, error } = await supabase.from('elections').select('*')
  if (error) throw new Error(`Failed to fetch elections: ${error.message}`)
  const map = {}
  for (const e of data) {
    const key = `${e.type}_${e.annee}_${e.tour || ''}`
    map[key] = e.id
  }
  return map
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const step = process.argv[2] || 'all'
  const elections = await getElectionIds()
  console.log('Election IDs:', elections)

  // Step 1: Reference data (departements + communes)
  if (step === 'all' || step === 'ref') {
    await importDepartements()
    await importCommunes()
  }

  // Step 2: Municipales 2026 T1
  if (step === 'all' || step === 'muni2026t1') {
    console.log('\n=== Municipales 2026 T1 - Communes ===')
    const elId = elections['municipales_2026_1']
    const { resultats, candidatures } = parseWideResults(
      join(DATA_DIR, 'resultats-communes.csv'), elId,
      { maxCandidats: 13, hasSiegesCC: true }
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)

    console.log('\n=== Municipales 2026 T1 - PLM ===')
    const { resultats: plmRes, candidatures: plmCand } = parseWideResults(
      join(DATA_DIR, 'resultats-plm.csv'), elId,
      { isSector: true, sectorField: 'Code secteur', maxCandidats: 11, hasSiegesCM: false, hasSiegesCC: false, hasSieges: true, hasElu: false, hasNom: false }
    )
    await batchInsert('resultats_vote', plmRes)
    await batchInsert('candidatures', plmCand)
  }

  // Step 3: Municipales 2026 T2
  if (step === 'all' || step === 'muni2026t2') {
    console.log('\n=== Municipales 2026 T2 - Communes ===')
    const elId = elections['municipales_2026_2']
    const { resultats, candidatures } = parseWideResults(
      join(DOWNLOADS_DIR, 'muni-2026-t2-communes.csv'), elId,
      { maxCandidats: 5 }
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)

    console.log('\n=== Municipales 2026 T2 - PLM ===')
    const { resultats: plmRes, candidatures: plmCand } = parseWideResults(
      join(DOWNLOADS_DIR, 'muni-2026-t2-plm.csv'), elId,
      { isSector: true, sectorField: 'Code secteur', maxCandidats: 4, hasSiegesCM: false, hasSiegesCC: false, hasSieges: true }
    )
    await batchInsert('resultats_vote', plmRes)
    await batchInsert('candidatures', plmCand)

    console.log('\n=== Municipales 2026 T2 - Élus ===')
    const elus = parseElusCsv(join(DOWNLOADS_DIR, 'muni-2026-t2-elus.csv'), 'conseiller_municipal')
    await batchInsert('elus', elus)
  }

  // Step 4: Municipales 2020 T1
  if (step === 'all' || step === 'muni2020t1') {
    console.log('\n=== Municipales 2020 T1 - communes ≥1000 ===')
    const elId = elections['municipales_2020_1']
    const { resultats, candidatures } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t1-1000plus.txt'), elId
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)

    console.log('\n=== Municipales 2020 T1 - communes <1000 ===')
    const { resultats: r2, candidatures: c2 } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t1-moins1000.txt'), elId
    )
    await batchInsert('resultats_vote', r2)
    await batchInsert('candidatures', c2)
  }

  // Step 4b: Municipales 2020 T1 small communes only
  if (step === 'muni2020t1small') {
    console.log('\n=== Municipales 2020 T1 - communes <1000 ===')
    const elId = elections['municipales_2020_1']
    const { resultats, candidatures } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t1-moins1000.txt'), elId
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)
  }

  // Step 5: Municipales 2020 T2
  if (step === 'all' || step === 'muni2020t2') {
    console.log('\n=== Municipales 2020 T2 - communes ≥1000 ===')
    const elId = elections['municipales_2020_2']
    const { resultats, candidatures } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t2-1000plus.txt'), elId
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)

    console.log('\n=== Municipales 2020 T2 - communes <1000 ===')
    const { resultats: r2, candidatures: c2 } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t2-moins1000.txt'), elId
    )
    await batchInsert('resultats_vote', r2)
    await batchInsert('candidatures', c2)
  }

  // Step 5b: Municipales 2020 T2 small communes only
  if (step === 'muni2020t2small') {
    console.log('\n=== Municipales 2020 T2 - communes <1000 ===')
    const elId = elections['municipales_2020_2']
    const { resultats, candidatures } = parse2020Results(
      join(DOWNLOADS_DIR, 'muni-2020-t2-moins1000.txt'), elId
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)
  }

  // Step 6: Européennes 2024
  if (step === 'all' || step === 'euro2024') {
    console.log('\n=== Européennes 2024 par commune ===')
    const elId = elections['europeennes_2024_']
    const { resultats, candidatures } = parseEuropeennesResults(
      join(DOWNLOADS_DIR, 'europeennes-2024-communes.csv'), elId
    )
    await batchInsert('resultats_vote', resultats)
    await batchInsert('candidatures', candidatures)
  }

  // Step 7: RNE Maires
  if (step === 'all' || step === 'rne') {
    console.log('\n=== RNE - Maires ===')
    const maires = parseElusCsv(join(DOWNLOADS_DIR, 'rne-maires.csv'), 'maire')
    await batchInsert('elus', maires)
  }

  // Step 8: RNE Conseillers municipaux
  if (step === 'all' || step === 'rne-cm') {
    console.log('\n=== RNE - Conseillers municipaux ===')
    const cm = parseElusCsv(join(DOWNLOADS_DIR, 'rne-conseillers-municipaux.csv'), 'conseiller_municipal_rne')
    await batchInsert('elus', cm)
  }

  // Step 9: Élus 2020
  if (step === 'all' || step === 'elus2020') {
    console.log('\n=== Élus municipaux 2020 T1+T2 ===')
    const content = readFileSync(join(DOWNLOADS_DIR, 'muni-2020-elus.txt'), 'latin1')
    const lines = content.split('\n').filter(l => l.trim())
    const sep = lines[0].includes('\t') ? '\t' : ';'
    const headers = lines[0].split(sep)
    console.log('  Headers:', headers.length, 'Separator:', JSON.stringify(sep))
    const elus = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep)
      if (cols.length < 7) continue
      const codeDep = cols[0].padStart(2, '0')
      elus.push({
        nom: cols[4] || '',
        prenom: cols[5] || '',
        sexe: cols[3] || null,
        date_naissance: convertFrDate(cols[6]),
        code_commune: codeDep + cols[1].padStart(3, '0'),
        code_departement: codeDep,
        mandat_type: 'conseiller_municipal_2020',
        date_debut_mandat: null,
        date_debut_fonction: null,
        csp_code: null,
        csp_libelle: null,
        nuance: null,
        sortant: null,
        election_tour: cols[7] === 'O' ? 'élu EPCI' : null,
      })
    }
    console.log('  Parsed:', elus.length, 'élus')
    await batchInsert('elus', elus)
  }

  // Step 10: Élus arrondissements PLM 2026
  if (step === 'all' || step === 'plm-elus') {
    console.log('\n=== Élus arrondissements PLM 2026 ===')
    const elus = parseElusCsv(join(DOWNLOADS_DIR, 'plm-2026-t2-elus.csv'), 'conseiller_arrondissement')
    await batchInsert('elus', elus)
  }

  console.log('\n=== Import terminé ===')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
