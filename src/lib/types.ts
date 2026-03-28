export interface CandidateResult {
  readonly numero: number
  readonly nom: string
  readonly prenom: string
  readonly sexe: string
  readonly nuance: string
  readonly libelleAbrege: string
  readonly libelleListe: string
  readonly voix: number
  readonly pourcentageInscrits: number
  readonly pourcentageExprimes: number
  readonly elu: boolean
  readonly siegesCM: number
  readonly siegesCC: number
}

export interface CommuneResult {
  readonly codeDepartement: string
  readonly codeCommune: string
  readonly libelleCommune: string
  readonly inscrits: number
  readonly votants: number
  readonly pourcentageVotants: number
  readonly abstentions: number
  readonly pourcentageAbstentions: number
  readonly exprimes: number
  readonly blancs: number
  readonly nuls: number
  readonly candidats: readonly CandidateResult[]
}

export interface DepartementSummary {
  readonly codeDepartement: string
  readonly libelleDepartement: string
  readonly inscrits: number
  readonly votants: number
  readonly pourcentageVotants: number
  readonly nuanceDominante: string
  readonly communeCount: number
}

export type ViewMode = 'parti' | 'participation'

export type CompetitionFilter = 'all' | 'duel' | 'triangulaire' | 'sans'

export interface SelectedZone {
  readonly type: 'departement' | 'commune'
  readonly code: string
  readonly label: string
}
