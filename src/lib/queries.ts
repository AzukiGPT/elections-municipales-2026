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

  // Get vote results
  const { data: votes, error: e2 } = await supabase
    .from('resultats_vote')
    .select('*')
    .eq('election_id', electionId)
    .in('code_commune', codes)
  if (e2) throw new Error(e2.message)

  // Get candidatures
  const { data: cands, error: e3 } = await supabase
    .from('candidatures')
    .select('*')
    .eq('election_id', electionId)
    .in('code_commune', codes)
  if (e3) throw new Error(e3.message)

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

export async function fetchPlmResults(
  electionId: number,
  codeDepartement: string
): Promise<CommuneResult[]> {
  // PLM arrondissements have is_arrondissement=true or code contains SR
  const { data: communeCodes, error: e1 } = await supabase
    .from('communes')
    .select('code, libelle')
    .eq('code_departement', codeDepartement)
    .eq('is_arrondissement', true)
  if (e1) throw new Error(e1.message)

  const codes = (communeCodes ?? []).map(c => c.code)
  if (codes.length === 0) return []

  const nameMap = new Map<string, string>()
  for (const c of communeCodes ?? []) nameMap.set(c.code, c.libelle)

  const { data: votes, error: e2 } = await supabase
    .from('resultats_vote')
    .select('*')
    .eq('election_id', electionId)
    .in('code_commune', codes)
  if (e2) throw new Error(e2.message)

  const { data: cands, error: e3 } = await supabase
    .from('candidatures')
    .select('*')
    .eq('election_id', electionId)
    .in('code_commune', codes)
  if (e3) throw new Error(e3.message)

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
