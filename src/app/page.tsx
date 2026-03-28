'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { ViewMode, CompetitionFilter, ActiveTab, DepartementSummary, CommuneResult, Election } from '@/lib/types'
import { fetchElections, fetchDepartementsSummary, fetchCommuneResults, fetchPlmResults } from '@/lib/queries'
import ToggleView from '@/components/ToggleView'
import Legend from '@/components/Legend'
import SidePanel from '@/components/SidePanel'
import SearchBar from '@/components/SearchBar'
import CompetitionFilterBar from '@/components/CompetitionFilter'
import TabBar from '@/components/TabBar'
import ElectionSelector from '@/components/ElectionSelector'
import PartiesView from '@/components/PartiesView'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

const PLM_COMMUNES: Record<string, string> = {
  '75056': '75',
  '69123': '69',
  '13055': '13',
}

export default function Home() {
  // Global state
  const [activeTab, setActiveTab] = useState<ActiveTab>('carte')
  const [elections, setElections] = useState<Election[]>([])
  const [selectedElection, setSelectedElection] = useState<Election | null>(null)
  const [loading, setLoading] = useState(true)

  // Map state
  const [viewMode, setViewMode] = useState<ViewMode>('parti')
  const [departements, setDepartements] = useState<DepartementSummary[]>([])
  const [activeDepartement, setActiveDepartement] = useState<string | null>(null)
  const [plmActive, setPlmActive] = useState<string | null>(null)
  const [communeResults, setCommuneResults] = useState<CommuneResult[]>([])
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null)
  const [hoverLabel, setHoverLabel] = useState<string | null>(null)
  const [filterNuance, setFilterNuance] = useState<string | null>(null)
  const [competitionFilter, setCompetitionFilter] = useState<CompetitionFilter>('all')
  const [deptsLoading, setDeptsLoading] = useState(false)

  // Load elections on mount
  useEffect(() => {
    fetchElections()
      .then(els => {
        setElections(els)
        // Default to Municipales 2026 T1
        const defaultEl = els.find(e => e.annee === 2026 && e.tour === null && e.type === 'municipales') ?? els.find(e => e.annee === 2026 && e.tour === 1) ?? els[0]
        if (defaultEl) setSelectedElection(defaultEl)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load departements when election changes
  useEffect(() => {
    if (!selectedElection) return
    setDeptsLoading(true)
    setActiveDepartement(null)
    setPlmActive(null)
    setSelectedCommune(null)
    setCommuneResults([])
    setFilterNuance(null)
    fetchDepartementsSummary(selectedElection.id)
      .then(setDepartements)
      .catch(() => setDepartements([]))
      .finally(() => setDeptsLoading(false))
  }, [selectedElection])

  // Load commune results when department changes
  useEffect(() => {
    if (!activeDepartement || !selectedElection) {
      setCommuneResults([])
      setSelectedCommune(null)
      setCompetitionFilter('all')
      return
    }

    const loadFn = plmActive
      ? fetchPlmResults(selectedElection.id, activeDepartement)
      : fetchCommuneResults(selectedElection.id, activeDepartement)

    loadFn
      .then(setCommuneResults)
      .catch(() => setCommuneResults([]))
  }, [activeDepartement, plmActive, selectedElection])

  const handleSelectDepartement = useCallback((code: string) => {
    if (activeDepartement === code) return
    setPlmActive(null)
    setSelectedCommune(null)
    setActiveDepartement(code)
  }, [activeDepartement])

  const handleSelectCommune = useCallback((code: string) => {
    const plmDep = PLM_COMMUNES[code]
    if (plmDep) {
      setPlmActive(`plm-${plmDep}`)
      setSelectedCommune(null)
      return
    }
    setSelectedCommune(code)
  }, [])

  const handleBack = useCallback(() => {
    if (plmActive) {
      setPlmActive(null)
      setSelectedCommune(null)
      return
    }
    setActiveDepartement(null)
    setSelectedCommune(null)
  }, [plmActive])

  const handleClosePanel = useCallback(() => {
    setSelectedCommune(null)
  }, [])

  const handleSearch = useCallback((communeCode: string, depCode: string, plm?: boolean) => {
    setActiveTab('carte')
    if (plm) {
      setActiveDepartement(depCode)
      setPlmActive(`plm-${depCode}`)
      setSelectedCommune(null)
      return
    }
    setPlmActive(null)
    setActiveDepartement(depCode)
    setTimeout(() => setSelectedCommune(communeCode), 300)
  }, [])

  const handleElectionChange = useCallback((election: Election) => {
    setSelectedElection(election)
  }, [])

  const selectedCommuneData = useMemo(() => {
    if (!selectedCommune) return null
    return communeResults.find(c => c.codeCommune === selectedCommune) ?? null
  }, [selectedCommune, communeResults])

  const panelDept = useMemo(() => {
    if (activeDepartement && !selectedCommune) {
      return departements.find(d => d.codeDepartement === activeDepartement) ?? null
    }
    return null
  }, [activeDepartement, selectedCommune, departements])

  const visibleNuances = useMemo(() => {
    if (activeDepartement && communeResults.length > 0) {
      const nuances = new Set<string>()
      for (const c of communeResults) {
        if (c.candidats.length === 0) continue
        const leading = c.candidats.reduce((best, cand) => cand.voix > best.voix ? cand : best, c.candidats[0])
        if (leading.nuance) nuances.add(leading.nuance)
      }
      return Array.from(nuances).sort()
    }
    const nuances = new Set<string>()
    for (const d of departements) {
      if (d.nuanceDominante) nuances.add(d.nuanceDominante)
    }
    return Array.from(nuances).sort()
  }, [departements, communeResults, activeDepartement])

  const nationalStats = useMemo(() => {
    if (departements.length === 0) return null
    const totalInscrits = departements.reduce((s, d) => s + d.inscrits, 0)
    const totalVotants = departements.reduce((s, d) => s + d.votants, 0)
    return {
      totalInscrits,
      totalVotants,
      totalCommunes: departements.reduce((s, d) => s + d.communeCount, 0),
      totalDepartements: departements.length,
      pourcentageVotants: totalInscrits > 0 ? Math.round((totalVotants / totalInscrits) * 10000) / 100 : 0,
    }
  }, [departements])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top header bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4 shrink-0 z-30">
        <h1 className="text-sm font-bold text-slate-800 shrink-0">
          Elections France
        </h1>
        <ElectionSelector
          elections={elections}
          selected={selectedElection}
          onChange={handleElectionChange}
        />
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'carte' && !activeDepartement && (
          <div className="ml-auto">
            <SearchBar onSelect={handleSearch} />
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'carte' ? (
          // ─── Map View ───────────────────────────────
          <>
            <Map
              viewMode={viewMode}
              departements={departements}
              onSelectDepartement={handleSelectDepartement}
              onSelectCommune={handleSelectCommune}
              activeDepartement={activeDepartement}
              plmActive={plmActive}
              communeResults={communeResults}
              filterNuance={filterNuance}
              competitionFilter={competitionFilter}
              onHover={setHoverLabel}
            />

            {/* Map overlay controls */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
              {deptsLoading ? (
                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-4 py-2">
                  <div className="text-sm text-slate-500">Chargement des données...</div>
                </div>
              ) : (
                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-4 py-2">
                  <h2 className="text-sm font-bold text-slate-800">
                    {selectedElection?.description ?? ''}
                  </h2>
                  {nationalStats && (
                    <p className="text-xs text-slate-500">
                      {nationalStats.totalCommunes.toLocaleString('fr-FR')} communes — {nationalStats.pourcentageVotants}% participation
                    </p>
                  )}
                </div>
              )}
              <ToggleView viewMode={viewMode} onChange={setViewMode} />
              {activeDepartement && (
                <CompetitionFilterBar value={competitionFilter} onChange={setCompetitionFilter} />
              )}
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10">
              <Legend
                viewMode={viewMode}
                visibleNuances={visibleNuances}
                filterNuance={filterNuance}
                onFilterChange={setFilterNuance}
              />
            </div>

            {/* Back button */}
            {activeDepartement && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <button
                  onClick={handleBack}
                  className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  ← {plmActive
                    ? `Retour à ${departements.find(d => d.codeDepartement === activeDepartement)?.libelleDepartement ?? activeDepartement}`
                    : `${departements.find(d => d.codeDepartement === activeDepartement)?.libelleDepartement ?? activeDepartement} — Retour à la France`
                  }
                </button>
              </div>
            )}

            {/* Hover tooltip */}
            {hoverLabel && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm shadow-lg pointer-events-none">
                {hoverLabel}
              </div>
            )}

            {/* Side panel */}
            <SidePanel
              commune={selectedCommuneData}
              departement={panelDept}
              activeDepartement={activeDepartement}
              filterNuance={filterNuance}
              communeResults={communeResults}
              onBack={handleBack}
              onClose={handleClosePanel}
            />
          </>
        ) : (
          // ─── Parties View ───────────────────────────
          selectedElection && (
            <PartiesView electionId={selectedElection.id} />
          )
        )}
      </div>
    </div>
  )
}
