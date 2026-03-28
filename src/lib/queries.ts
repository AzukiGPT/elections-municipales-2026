import { supabase } from './supabase'
import type { Election, DepartementSummary, CommuneResult, PartyStatsRow } from './types'

export async function fetchElections(): Promise<Election[]> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .order('annee', { ascending: false })
    .order('tour', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchDepartementsSummary(electionId: number): Promise<DepartementSummary[]> {
  // Get dept aggregations
  const { data: depts, error: e1 } = await supabase
    .from('dept_summary')
    .select('*')
    .eq('election_id', electionId)
  if (e1) throw new Error(e1.message)

  // Get dominant nuance per dept
  const { data: dominant, error: e2 } = await supabase
    .from('dept_dominant_nuance')
    .select('*')
    .eq('election_id', electionId)
  if (e2) throw new Error(e2.message)

  const dominantMap = new Map<string, string>()
  for (const d of dominant ?? []) {
    dominantMap.set(d.code_departement, d.nuance_dominante)
  }

  return (depts ?? []).map(d => ({
    codeDepartement: d.code_departement,
    libelleDepartement: d.libelle_departement,
    inscrits: d.inscrits,
    votants: d.votants,
    pourcentageVotants: Number(d.pourcentage_votants) || 0,
    nuanceDominante: dominantMap.get(d.code_departement) ?? '',
    communeCount: d.commune_count,
  }))
}

export async function fetchCommuneResults(
  electionId: number,
  codeDepartement: string
): Promise<CommuneResult[]> {
  // Get all commune codes for this department
  const { data: communeCodes, error: e1 } = await supabase
    .from('communes')
    .select('code')
    .eq('code_departement', codeDepartement)
    .eq('is_arrondissement', false)
  if (e1) throw new Error(e1.message)

  const codes = (communeCodes ?? []).map(c => c.code)
  if (codes.length === 0) return []

  // Get vote results (paginate for large departments)
  const allVotes: { id: number; election_id: number; code_commune: string; inscrits: number; votants: number; abstentions: number; exprimes: number; blancs: number; nuls: number }[] = []
  let votePage = 0
  while (true) {
    const { data: batch, error: e2 } = await supabase
      .from('resultats_vote')
      .select('*')
      .eq('election_id', electionId)
      .in('code_commune', codes)
      .range(votePage * 1000, (votePage + 1) * 1000 - 1)
    if (e2) throw new Error(e2.message)
    if (!batch || batch.length === 0) break
    allVotes.push(...batch)
    if (batch.length < 1000) break
    votePage++
  }
  const votes = allVotes

  // Get candidatures (paginate to avoid 1000 row limit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCands: any[] = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data: batch, error: e3 } = await supabase
      .from('candidatures')
      .select('*')
      .eq('election_id', electionId)
      .in('code_commune', codes)
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (e3) throw new Error(e3.message)
    if (!batch || batch.length === 0) break
    allCands.push(...batch)
    if (batch.length < pageSize) break
    page++
  }
  const cands = allCands

  // Get commune names
  const { data: communeNames, error: e4 } = await supabase
    .from('communes')
    .select('code, libelle')
    .in('code', codes)
  if (e4) throw new Error(e4.message)

  const nameMap = new Map<string, string>()
  for (const c of communeNames ?? []) nameMap.set(c.code, c.libelle)

  // Group candidatures by commune
  const candsByCommune = new Map<string, typeof cands>()
  for (const c of cands ?? []) {
    const list = candsByCommune.get(c.code_commune) ?? []
    list.push(c)
    candsByCommune.set(c.code_commune, list)
  }

  return (votes ?? []).map(v => {
    const candidats = (candsByCommune.get(v.code_commune) ?? []).map(c => ({
      numero: c.numero_panneau ?? 0,
      nom: c.nom ?? '',
      prenom: c.prenom ?? '',
      sexe: c.sexe ?? '',
      nuance: c.nuance ?? '',
      libelleAbrege: c.libelle_abrege ?? '',
      libelleListe: c.libelle_liste ?? '',
      voix: c.voix,
      pourcentageInscrits: Number(c.pct_inscrits) || 0,
      pourcentageExprimes: Number(c.pct_exprimes) || 0,
      elu: c.elu ?? false,
      siegesCM: c.sieges_cm ?? c.sieges ?? 0,
      siegesCC: c.sieges_cc ?? 0,
    }))

    return {
      codeDepartement,
      codeCommune: v.code_commune,
      libelleCommune: nameMap.get(v.code_commune) ?? v.code_commune,
      inscrits: v.inscrits,
      votants: v.votants,
      pourcentageVotants: v.inscrits > 0 ? Math.round((v.votants / v.inscrits) * 10000) / 100 : 0,
      abstentions: v.abstentions,
      pourcentageAbstentions: v.inscrits > 0 ? Math.round((v.abstentions / v.inscrits) * 10000) / 100 : 0,
      exprimes: v.exprimes,
      blancs: v.blancs,
      nuls: v.nuls,
      candidats,
    }
  })
}

// Mapping from sector codes to GeoJSON arrondissement codes
const MARSEILLE_SECTOR_TO_ARR: Record<string, string[]> = {
  '01': ['13201', '13207'], '02': ['13202', '13203'],
  '03': ['13204', '13205'], '04': ['13206', '13208'],
  '05': ['13209', '13210'], '06': ['13211', '13212'],
  '07': ['13213', '13214'], '08': ['13215', '13216'],
}

function sectorToGeoCodes(sectorCode: string, dep: string): string[] {
  const num = sectorCode.replace(/.*SR/, '')
  if (dep === '75') {
    if (num === '01') return ['75101', '75102', '75103', '75104']
    return [`751${num}`]
  }
  if (dep === '69') return [`69${380 + parseInt(num, 10)}`]
  if (dep === '13') return MARSEILLE_SECTOR_TO_ARR[num] ?? []
  return [sectorCode]
}

export async function fetchPlmResults(
  electionId: number,
  codeDepartement: string
): Promise<CommuneResult[]> {
  // PLM results are stored under sector codes (75056SR01, 13055SR02, etc.)
  // We need to fetch those and map them to GeoJSON arrondissement codes
  const { data: sectorCommunes, error: e1 } = await supabase
    .from('communes')
    .select('code, libelle')
    .eq('code_departement', codeDepartement)
    .eq('is_arrondissement', true)
    .like('code', '%SR%')
  if (e1) throw new Error(e1.message)

  const sectorCodes = (sectorCommunes ?? []).map(c => c.code)
  if (sectorCodes.length === 0) return []

  const { data: votes, error: e2 } = await supabase
    .from('resultats_vote')
    .select('*')
    .eq('election_id', electionId)
    .in('code_commune', sectorCodes)
  if (e2) throw new Error(e2.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCands: any[] = []
  let candPage = 0
  while (true) {
    const { data: batch, error: e3 } = await supabase
      .from('candidatures')
      .select('*')
      .eq('election_id', electionId)
      .in('code_commune', sectorCodes)
      .range(candPage * 1000, (candPage + 1) * 1000 - 1)
    if (e3) throw new Error(e3.message)
    if (!batch || batch.length === 0) break
    allCands.push(...batch)
    if (batch.length < 1000) break
    candPage++
  }

  const candsByCommune = new Map<string, typeof allCands>()
  for (const c of allCands) {
    const list = candsByCommune.get(c.code_commune) ?? []
    list.push(c)
    candsByCommune.set(c.code_commune, list)
  }

  // Get sector name map
  const nameMap = new Map<string, string>()
  for (const c of sectorCommunes ?? []) nameMap.set(c.code, c.libelle)

  // Expand each sector result into GeoJSON arrondissement codes
  const results: CommuneResult[] = []
  for (const v of votes ?? []) {
    const geoCodes = sectorToGeoCodes(v.code_commune, codeDepartement)
    const candidats = (candsByCommune.get(v.code_commune) ?? []).map((c: Record<string, unknown>) => ({
      numero: (c.numero_panneau as number) ?? 0,
      nom: (c.nom as string) ?? '',
      prenom: (c.prenom as string) ?? '',
      sexe: (c.sexe as string) ?? '',
      nuance: (c.nuance as string) ?? '',
      libelleAbrege: (c.libelle_abrege as string) ?? '',
      libelleListe: (c.libelle_liste as string) ?? '',
      voix: c.voix as number,
      pourcentageInscrits: Number(c.pct_inscrits) || 0,
      pourcentageExprimes: Number(c.pct_exprimes) || 0,
      elu: (c.elu as boolean) ?? false,
      siegesCM: (c.sieges_cm as number) ?? (c.sieges as number) ?? 0,
      siegesCC: (c.sieges_cc as number) ?? 0,
    }))

    for (const geoCode of geoCodes) {
      results.push({
        codeDepartement,
        codeCommune: geoCode,
        libelleCommune: nameMap.get(v.code_commune) ?? v.code_commune,
        inscrits: v.inscrits,
        votants: v.votants,
        pourcentageVotants: v.inscrits > 0 ? Math.round((v.votants / v.inscrits) * 10000) / 100 : 0,
        abstentions: v.abstentions,
        pourcentageAbstentions: v.inscrits > 0 ? Math.round((v.abstentions / v.inscrits) * 10000) / 100 : 0,
        exprimes: v.exprimes,
        blancs: v.blancs,
        nuls: v.nuls,
        candidats,
      })
    }
  }

  return results
}

export async function fetchPartyStats(electionId: number): Promise<PartyStatsRow[]> {
  const { data: stats, error: e1 } = await supabase
    .from('party_stats')
    .select('*')
    .eq('election_id', electionId)
  if (e1) throw new Error(e1.message)

  const { data: wins, error: e2 } = await supabase
    .from('party_wins')
    .select('*')
    .eq('election_id', electionId)
  if (e2) throw new Error(e2.message)

  const winsMap = new Map<string, number>()
  for (const w of wins ?? []) winsMap.set(w.nuance, w.communes_gagnees)

  return (stats ?? [])
    .filter(s => s.nuance && s.nuance !== '')
    .map(s => ({
      nuance: s.nuance,
      communes_presentes: Number(s.communes_presentes) || 0,
      communes_gagnees: winsMap.get(s.nuance) ?? 0,
      score_moyen: Number(s.score_moyen) || 0,
      total_voix: Number(s.total_voix) || 0,
      total_sieges: Number(s.total_sieges) || 0,
    }))
    .sort((a, b) => b.total_voix - a.total_voix)
}

export async function fetchPartyCommunes(
  electionId: number,
  nuance: string
): Promise<{ code: string; nom: string; departement: string; voix: number; pctExprimes: number; sieges: number; isWinner: boolean }[]> {
  const { data, error } = await supabase
    .from('candidatures')
    .select('code_commune, voix, pct_exprimes, sieges_cm, sieges')
    .eq('election_id', electionId)
    .eq('nuance', nuance)
    .order('pct_exprimes', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)

  if (!data || data.length === 0) return []

  // Get commune names
  const codes = data.map(d => d.code_commune)
  const { data: communes } = await supabase
    .from('communes')
    .select('code, libelle, code_departement')
    .in('code', codes)

  const communeMap = new Map<string, { libelle: string; dept: string }>()
  for (const c of communes ?? []) communeMap.set(c.code, { libelle: c.libelle, dept: c.code_departement })

  // Determine winners: get the max voix candidate per commune for these communes
  const { data: allCands } = await supabase
    .from('candidatures')
    .select('code_commune, nuance, voix')
    .eq('election_id', electionId)
    .in('code_commune', codes)

  const winnerMap = new Map<string, string>()
  const maxVoix = new Map<string, number>()
  for (const c of allCands ?? []) {
    const current = maxVoix.get(c.code_commune) ?? 0
    if (c.voix > current) {
      maxVoix.set(c.code_commune, c.voix)
      winnerMap.set(c.code_commune, c.nuance)
    }
  }

  return data.map(d => {
    const info = communeMap.get(d.code_commune)
    return {
      code: d.code_commune,
      nom: info?.libelle ?? d.code_commune,
      departement: info?.dept ?? '',
      voix: d.voix,
      pctExprimes: Number(d.pct_exprimes) || 0,
      sieges: (d.sieges_cm ?? 0) + (d.sieges ?? 0),
      isWinner: winnerMap.get(d.code_commune) === nuance,
    }
  })
}

export async function fetchSearchIndex(): Promise<{ code: string; nom: string; dep: string; depNom: string; plm?: boolean }[]> {
  const { data, error } = await supabase
    .from('communes')
    .select('code, libelle, code_departement, is_arrondissement')
  if (error) throw new Error(error.message)

  const { data: depts } = await supabase
    .from('departements')
    .select('code, libelle')

  const deptMap = new Map<string, string>()
  for (const d of depts ?? []) deptMap.set(d.code, d.libelle)

  return (data ?? []).map(c => ({
    code: c.code,
    nom: c.libelle,
    dep: c.code_departement,
    depNom: deptMap.get(c.code_departement) ?? c.code_departement,
    plm: c.is_arrondissement ? true : undefined,
  }))
}
