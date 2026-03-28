'use client'

import type { ViewMode } from '@/lib/types'
import { NUANCE_COLORS, getParticipationColor, getNuanceLabel } from '@/lib/colors'

interface LegendProps {
  readonly viewMode: ViewMode
  readonly visibleNuances: readonly string[]
  readonly filterNuance: string | null
  readonly onFilterChange: (nuance: string | null) => void
}

export default function Legend({ viewMode, visibleNuances, filterNuance, onFilterChange }: LegendProps) {
  if (viewMode === 'participation') {
    const steps = [30, 40, 50, 60, 70, 80, 90]
    return (
      <div className="bg-white/95 rounded-lg shadow-md p-3 text-xs">
        <div className="font-semibold mb-2 text-slate-700">Taux de participation</div>
        <div className="flex items-center gap-0.5">
          {steps.map((pct) => (
            <div key={pct} className="flex flex-col items-center">
              <div
                className="w-6 h-4 rounded-sm"
                style={{ backgroundColor: getParticipationColor(pct) }}
              />
              <span className="text-slate-500 mt-1">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Mode parti — afficher uniquement les nuances présentes
  const nuancesToShow = visibleNuances.filter(n => n in NUANCE_COLORS)

  const handleClick = (nuance: string) => {
    onFilterChange(filterNuance === nuance ? null : nuance)
  }

  return (
    <div className="bg-white/95 rounded-lg shadow-md p-3 text-xs max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-700">Parti en tête</span>
        {filterNuance && (
          <button
            onClick={() => onFilterChange(null)}
            className="text-blue-600 hover:text-blue-800 text-xs"
          >
            Tout afficher
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {nuancesToShow.map((nuance) => {
          const isActive = !filterNuance || filterNuance === nuance
          return (
            <button
              key={nuance}
              onClick={() => handleClick(nuance)}
              className={`flex items-center gap-1.5 py-0.5 px-1 rounded text-left transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-30'
              } hover:bg-slate-100`}
            >
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: NUANCE_COLORS[nuance] }}
              />
              <span className="text-slate-600 truncate">{getNuanceLabel(nuance)}</span>
            </button>
          )
        })}
        <button
          onClick={() => handleClick('SANS')}
          className={`flex items-center gap-1.5 py-0.5 px-1 rounded text-left transition-opacity ${
            !filterNuance || filterNuance === 'SANS' ? 'opacity-100' : 'opacity-30'
          } hover:bg-slate-100`}
        >
          <div className="w-3 h-3 rounded-sm shrink-0 bg-gray-300" />
          <span className="text-slate-600">Sans étiquette</span>
        </button>
      </div>
    </div>
  )
}
