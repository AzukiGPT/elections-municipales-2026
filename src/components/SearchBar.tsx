'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface CommuneIndex {
  readonly code: string
  readonly nom: string
  readonly dep: string
  readonly depNom: string
  readonly plm?: boolean
}

interface SearchBarProps {
  readonly onSelect: (communeCode: string, depCode: string, plm?: boolean) => void
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommuneIndex[]>([])
  const [index, setIndex] = useState<CommuneIndex[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load search index
  useEffect(() => {
    fetch('/data/search-index.json')
      .then(r => r.json())
      .then(data => setIndex(data))
      .catch(() => {})
  }, [])

  // Search logic
  const search = useCallback((q: string) => {
    if (q.length < 2 || index.length === 0) {
      setResults([])
      setOpen(false)
      return
    }

    const normalized = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const matches = []
    const limit = 8

    // Exact start match first
    for (const item of index) {
      if (matches.length >= limit) break
      const normName = item.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normName.startsWith(normalized)) {
        matches.push(item)
      }
    }

    // Then contains match
    if (matches.length < limit) {
      for (const item of index) {
        if (matches.length >= limit) break
        if (matches.includes(item)) continue
        const normName = item.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (normName.includes(normalized)) {
          matches.push(item)
        }
      }
    }

    setResults(matches)
    setOpen(matches.length > 0)
    setHighlighted(-1)
  }, [index])

  useEffect(() => {
    search(query)
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback((item: CommuneIndex) => {
    setQuery('')
    setOpen(false)
    onSelect(item.code, item.dep, item.plm)
  }, [onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [open, highlighted, results, handleSelect])

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="Rechercher une commune..."
        className="w-64 px-3 py-2 text-sm bg-white rounded-lg shadow-md border-0 outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400"
      />

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
          {results.map((item, i) => (
            <button
              key={item.code}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                i === highlighted ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className="font-medium text-slate-800">{item.nom}</span>
              <span className="text-xs text-slate-400 ml-2 shrink-0">
                {item.depNom} ({item.dep})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
