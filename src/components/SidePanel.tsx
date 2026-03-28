'use client'

import type { CommuneResult, DepartementSummary } from '@/lib/types'
import { getNuanceColor, getNuanceLabel } from '@/lib/colors'

interface SidePanelProps {
  readonly commune: CommuneResult | null
  readonly departement: DepartementSummary | null
  readonly activeDepartement: string | null
  readonly filterNuance: string | null
  readonly communeResults: readonly CommuneResult[]
  readonly onBack: () => void
  readonly onClose: () => void
}

export default function SidePanel({
  commune,
  departement,
  activeDepartement,
  filterNuance,
  communeResults,
  onBack,
  onClose,
}: SidePanelProps) {
  // Show party stats panel when filter is active and viewing department-level
  const showPartyStats = !commune && departement && filterNuance && filterNuance !== 'SANS' && communeResults.length > 0

  if (!commune && !departement && !showPartyStats) return null

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-white/95 backdrop-blur-sm shadow-xl z-20 overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {activeDepartement && (
              <button
                onClick={onBack}
                className="text-xs text-blue-600 hover:text-blue-800 mb-1 flex items-center gap-1"
              >
                ← Retour aux départements
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-800 truncate">
              {commune ? commune.libelleCommune : departement?.libelleDepartement}
            </h2>
            {commune && (
              <span className="text-xs text-slate-500">
                {commune.codeDepartement} — {commune.codeCommune}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        {commune && <CommuneDetails commune={commune} />}
        {!commune && departement && <DepartementDetails departement={departement} />}
        {showPartyStats && (
          <PartyStats nuance={filterNuance} communes={communeResults} />
        )}
      </div>
    </div>
  )
}

function CommuneDetails({ commune }: { readonly commune: CommuneResult }) {
  const sortedCandidats = [...commune.candidats].sort((a, b) => b.voix - a.voix)
  const maxVoix = sortedCandidats[0]?.voix ?? 1

  return (
    <>
      {/* Participation */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBox label="Inscrits" value={commune.inscrits.toLocaleString('fr-FR')} />
        <StatBox label="Votants" value={commune.votants.toLocaleString('fr-FR')} />
        <StatBox
          label="Participation"
          value={`${commune.pourcentageVotants}%`}
          highlight
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <StatBox label="Exprimés" value={commune.exprimes.toLocaleString('fr-FR')} />
        <StatBox label="Blancs" value={commune.blancs.toLocaleString('fr-FR')} />
        <StatBox label="Nuls" value={commune.nuls.toLocaleString('fr-FR')} />
      </div>

      {/* Résultats par liste */}
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        Résultats par liste ({sortedCandidats.length})
      </h3>
      <div className="space-y-2">
        {sortedCandidats.map((c) => (
          <div key={c.numero} className="bg-slate-50 rounded-md p-2">
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getNuanceColor(c.nuance) }}
                  />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {c.libelleAbrege || c.libelleListe}
                  </span>
                </div>
                {c.nuance && (
                  <span className="text-xs text-slate-500 ml-4">
                    {getNuanceLabel(c.nuance)}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-sm font-bold text-slate-800">
                  {c.pourcentageExprimes.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">
                  {c.voix.toLocaleString('fr-FR')} voix
                </div>
              </div>
            </div>
            {/* Bar */}
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(c.voix / maxVoix) * 100}%`,
                  backgroundColor: getNuanceColor(c.nuance),
                }}
              />
            </div>
            {c.siegesCM > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                {c.siegesCM} siège{c.siegesCM > 1 ? 's' : ''} CM
                {c.elu && ' — Élu'}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function DepartementDetails({ departement }: { readonly departement: DepartementSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatBox label="Inscrits" value={departement.inscrits.toLocaleString('fr-FR')} />
      <StatBox label="Votants" value={departement.votants.toLocaleString('fr-FR')} />
      <StatBox
        label="Participation"
        value={`${departement.pourcentageVotants}%`}
        highlight
      />
      <StatBox label="Communes" value={departement.communeCount.toLocaleString('fr-FR')} />
      <div className="col-span-2 mt-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getNuanceColor(departement.nuanceDominante) }}
          />
          <span className="text-sm text-slate-700">
            Nuance dominante : {getNuanceLabel(departement.nuanceDominante)}
          </span>
        </div>
      </div>
      <p className="col-span-2 text-xs text-slate-500 mt-2">
        Cliquez sur le département pour voir les résultats par commune.
      </p>
    </div>
  )
}

function PartyStats({
  nuance,
  communes,
}: {
  readonly nuance: string
  readonly communes: readonly CommuneResult[]
}) {
  const communesWithParty: { nom: string; score: number; seats: number; isWinner: boolean }[] = []
  let totalSeats = 0

  for (const c of communes) {
    const candidate = c.candidats.find(cand => cand.nuance === nuance)
    if (!candidate) continue

    let best = c.candidats[0]
    for (const cand of c.candidats) {
      if (cand.voix > best.voix) best = cand
    }
    const isWinner = best.nuance === nuance
    totalSeats += candidate.siegesCM

    communesWithParty.push({
      nom: c.libelleCommune,
      score: candidate.pourcentageExprimes,
      seats: candidate.siegesCM,
      isWinner,
    })
  }

  if (communesWithParty.length === 0) return null

  const scores = communesWithParty.map(c => c.score)
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
  const wonCount = communesWithParty.filter(c => c.isWinner).length
  const sorted = [...communesWithParty].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: getNuanceColor(nuance) }}
        />
        <h3 className="text-sm font-semibold text-slate-700">
          {getNuanceLabel(nuance)}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatBox label="Communes gagnées" value={`${wonCount} / ${communes.length}`} highlight />
        <StatBox label="Score moyen" value={`${avgScore.toFixed(1)}%`} />
        <StatBox label="Présent dans" value={`${communesWithParty.length} communes`} />
        <StatBox label="Sièges CM" value={totalSeats.toLocaleString('fr-FR')} />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Meilleur score</span>
          <span className="font-medium">{best.nom} — {best.score.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Plus faible score</span>
          <span className="font-medium">{worst.nom} — {worst.score.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  readonly label: string
  readonly value: string
  readonly highlight?: boolean
}) {
  return (
    <div className={`rounded-md p-2 ${highlight ? 'bg-blue-50' : 'bg-slate-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  )
}
