'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PartyStatsRow } from '@/lib/types'
import { getNuanceColor, getNuanceLabel } from '@/lib/colors'
import { fetchPartyStats, fetchPartyCommunes } from '@/lib/queries'

interface PartiesViewProps {
  readonly electionId: number
}

interface CommuneDetail {
  readonly code: string
  readonly nom: string
  readonly departement: string
  readonly voix: number
  readonly pctExprimes: number
  readonly sieges: number
  readonly isWinner: boolean
}

export default function PartiesView({ electionId }: PartiesViewProps) {
  const [stats, setStats] = useState<PartyStatsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParty, setSelectedParty] = useState<string | null>(null)
  const [communes, setCommunes] = useState<CommuneDetail[]>([])
  const [communesLoading, setCommunesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    setSelectedParty(null)
    setCommunes([])
    fetchPartyStats(electionId)
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false))
  }, [electionId])

  const handleSelectParty = useCallback((nuance: string) => {
    setSelectedParty(nuance)
    setCommunesLoading(true)
    setSearchQuery('')
    fetchPartyCommunes(electionId, nuance)
      .then(setCommunes)
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false))
  }, [electionId])

  const handleBack = useCallback(() => {
    setSelectedParty(null)
    setCommunes([])
    setSearchQuery('')
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Chargement des données...</div>
      </div>
    )
  }

  if (selectedParty) {
    const partyStat = stats.find(s => s.nuance === selectedParty)
    const filtered = searchQuery
      ? communes.filter(c =>
          c.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.departement.includes(searchQuery)
        )
      : communes

    return (
      <PartyDetail
        nuance={selectedParty}
        stat={partyStat ?? null}
        communes={filtered}
        loading={communesLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onBack={handleBack}
      />
    )
  }

  return <PartyTable stats={stats} onSelect={handleSelectParty} />
}

function PartyTable({
  stats,
  onSelect,
}: {
  readonly stats: readonly PartyStatsRow[]
  readonly onSelect: (nuance: string) => void
}) {
  const totalVoix = stats.reduce((sum, s) => sum + s.total_voix, 0)

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Résultats par parti ({stats.length} nuances)
        </h2>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Parti</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Communes gagnées</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Score moyen</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total voix</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">% national</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Sièges</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr
                  key={s.nuance}
                  onClick={() => onSelect(s.nuance)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: getNuanceColor(s.nuance) }}
                      />
                      <div>
                        <div className="font-medium text-slate-800">
                          {getNuanceLabel(s.nuance)}
                        </div>
                        <div className="text-xs text-slate-400">{s.nuance}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-slate-700">
                    {s.communes_gagnees.toLocaleString('fr-FR')}
                    <span className="text-slate-400 text-xs ml-1">
                      / {s.communes_presentes.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-slate-700">
                    {s.score_moyen.toFixed(1)}%
                  </td>
                  <td className="text-right px-4 py-3 font-medium text-slate-800">
                    {s.total_voix.toLocaleString('fr-FR')}
                  </td>
                  <td className="text-right px-4 py-3 text-slate-700">
                    {totalVoix > 0 ? ((s.total_voix / totalVoix) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="text-right px-4 py-3 text-slate-700">
                    {s.total_sieges.toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PartyDetail({
  nuance,
  stat,
  communes,
  loading,
  searchQuery,
  onSearchChange,
  onBack,
}: {
  readonly nuance: string
  readonly stat: PartyStatsRow | null
  readonly communes: readonly CommuneDetail[]
  readonly loading: boolean
  readonly searchQuery: string
  readonly onSearchChange: (q: string) => void
  readonly onBack: () => void
}) {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:text-blue-800 mb-3"
        >
          ← Retour aux partis
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-5 h-5 rounded-full"
            style={{ backgroundColor: getNuanceColor(nuance) }}
          />
          <h2 className="text-xl font-bold text-slate-800">
            {getNuanceLabel(nuance)}
          </h2>
          <span className="text-sm text-slate-400">{nuance}</span>
        </div>

        {/* Stats cards */}
        {stat && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Communes gagnées" value={`${stat.communes_gagnees.toLocaleString('fr-FR')} / ${stat.communes_presentes.toLocaleString('fr-FR')}`} />
            <StatCard label="Score moyen" value={`${stat.score_moyen.toFixed(1)}%`} />
            <StatCard label="Total voix" value={stat.total_voix.toLocaleString('fr-FR')} />
            <StatCard label="Total sièges" value={stat.total_sieges.toLocaleString('fr-FR')} />
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher une commune..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full max-w-sm border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Communes table */}
        {loading ? (
          <div className="text-slate-500">Chargement...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Commune</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Département</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Score</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Voix</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Sièges</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">En tête</th>
                </tr>
              </thead>
              <tbody>
                {communes.map(c => (
                  <tr key={c.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-800">{c.nom}</td>
                    <td className="px-4 py-2 text-slate-500">{c.departement}</td>
                    <td className="text-right px-4 py-2 font-medium text-slate-800">
                      {c.pctExprimes.toFixed(1)}%
                    </td>
                    <td className="text-right px-4 py-2 text-slate-700">
                      {c.voix.toLocaleString('fr-FR')}
                    </td>
                    <td className="text-right px-4 py-2 text-slate-700">
                      {c.sieges > 0 ? c.sieges : '—'}
                    </td>
                    <td className="text-center px-4 py-2">
                      {c.isWinner && (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="En tête" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {communes.length === 0 && (
              <div className="text-center py-8 text-slate-400">Aucune commune trouvée</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
    </div>
  )
}
