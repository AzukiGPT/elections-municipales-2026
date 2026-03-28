'use client'

import type { Election } from '@/lib/types'

interface ElectionSelectorProps {
  readonly elections: readonly Election[]
  readonly selected: Election | null
  readonly onChange: (election: Election) => void
}

export default function ElectionSelector({ elections, selected, onChange }: ElectionSelectorProps) {
  return (
    <select
      value={selected?.id ?? ''}
      onChange={e => {
        const el = elections.find(x => x.id === Number(e.target.value))
        if (el) onChange(el)
      }}
      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {elections.map(el => (
        <option key={el.id} value={el.id}>
          {el.description}
        </option>
      ))}
    </select>
  )
}
