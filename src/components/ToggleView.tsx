'use client'

import type { ViewMode } from '@/lib/types'

interface ToggleViewProps {
  readonly viewMode: ViewMode
  readonly onChange: (mode: ViewMode) => void
}

export default function ToggleView({ viewMode, onChange }: ToggleViewProps) {
  return (
    <div className="flex gap-1 bg-white rounded-lg shadow-md p-1">
      <button
        onClick={() => onChange('parti')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          viewMode === 'parti'
            ? 'bg-slate-800 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        Parti en tête
      </button>
      <button
        onClick={() => onChange('participation')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          viewMode === 'participation'
            ? 'bg-slate-800 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        Participation
      </button>
    </div>
  )
}
