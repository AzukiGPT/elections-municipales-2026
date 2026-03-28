'use client'

import type { ActiveTab } from '@/lib/types'

interface TabBarProps {
  readonly activeTab: ActiveTab
  readonly onChange: (tab: ActiveTab) => void
}

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'carte', label: 'Carte' },
  { key: 'partis', label: 'Partis' },
]

export default function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab.key
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
