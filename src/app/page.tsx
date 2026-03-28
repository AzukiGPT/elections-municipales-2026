'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { ViewMode, CompetitionFilter, DepartementSummary, CommuneResult } from '@/lib/types'
import ToggleView from '@/components/ToggleView'
import Legend from '@/components/Legend'
import SidePanel from '@/components/SidePanel'
import SearchBar from '@/components/SearchBar'
import CompetitionFilterBar from '@/components/CompetitionFilter'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

// PLM communes that should drill-down into arrondissements
const PLM_COMMUNES: Record<string, string> = {
  '75056': '75',
  '69123': '69',
  '13055': '13',
}

interface NationalStats {
  readonly totalInscrits: number
  readonly totalVotants: number
  readonly totalCommunes: number
  readonly totalDepartements: number
  readonly pourcentageVotants: number
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('parti')
  const [departements, setDepartements] = useState<DepartementSummary[]>([])
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null)
  const [activeDepartement, setActiveDepartement] = useState<string | null>(null)
  const [plmActive, setPlmActive] = useState<string | null>(null) // 'plm-75', 'plm-69', 'plm-13'
  const [communeResults, setCommuneResults] = useState<CommuneResult[]>([])
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null)
  const [hoverLabel, setHoverLabel] = useState<string | null>(null)
  const [filterNuance, setFilterNuance] = useState<string | null>(null)
  const [competitionFilter, setCompetitionFilter] = useState<CompetitionFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/data/departements.json').then(r => r.json()),
      fetch('/data/national.json').then(r => r.json()),
    ]).then(([depts, national]) => {
      setDepartements(depts)
      setNationalStats(national)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeDepartement) {
      setCommuneResults([])
      setSelectedCommune(null)
      setPlmActive(null)
      setCompetitionFilter('all')
      return
    }

    // If PLM is active, load PLM data instead of regular commune data
    const dataFile = plmActive ?? activeDepartement
    fetch(`/data/communes/${dataFile}.json`)
      .then(r => r.json())
      .then(data => setCommuneResults(data))
      .catch(() => setCommuneResults([]))
  }, [activeDepartement, plmActive])

  const handleSelectDepartement = useCallback((code: string) => {
    // If already viewing this department (with or without PLM), ignore
    if (activeDepartement === code) return
    setPlmActive(null)
    setSelectedCommune(null)
    setActiveDepartement(code)
  }, [activeDepartement])

  const handleSelectCommune = useCallback((code: string) => {
    // Check if this is a PLM commune — drill into arrondissements
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
      // Go back from PLM view to department commune view
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
    if (plm) {
      // PLM search — drill into the department, then activate PLM view
      setActiveDepartement(depCode)
      setPlmActive(`plm-${depCode}`)
      setSelectedCommune(null)
      return
    }
    // Regular commune search — navigate to department then select
    setPlmActive(null)
    setActiveDepartement(depCode)
    setTimeout(() => setSelectedCommune(communeCode), 300)
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

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Chargement des données...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden">
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

      {/* Top bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-4 py-2">
          <h1 className="text-sm font-bold text-slate-800">
            Municipales 2026 — 1er tour
          </h1>
          {nationalStats && (
            <p className="text-xs text-slate-500">
              {nationalStats.totalCommunes.toLocaleString('fr-FR')} communes — {nationalStats.pourcentageVotants}% participation
            </p>
          )}
        </div>
        <ToggleView viewMode={viewMode} onChange={setViewMode} />
        {activeDepartement && (
          <CompetitionFilterBar value={competitionFilter} onChange={setCompetitionFilter} />
        )}
      </div>

      {/* Search */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        {!activeDepartement && <SearchBar onSelect={handleSearch} />}
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

      {/* Back button when drilled in */}
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
    </div>
  )
}
