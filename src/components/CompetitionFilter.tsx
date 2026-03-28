'use client'

import type { CompetitionFilter as FilterType } from '@/lib/types'

const OPTIONS: readonly { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'duel', label: 'Duels' },
  { value: 'triangulaire', label: 'Triangulaires+' },
  { value: 'sans', label: 'Sans compétition' },
]

interface CompetitionFilterProps {
  readonly value: FilterType
  readonly onChange: (value: FilterType) => void
}

export default function CompetitionFilter({ value, onChange }: CompetitionFilterProps) {
  return (
    <div className="flex gap-1 bg-white rounded-lg shadow-md p-1">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            value === opt.value
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
