'use client'

import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ViewMode, DepartementSummary, CommuneResult, CompetitionFilter } from '@/lib/types'
import { getNuanceColor, getParticipationColor, getPartyScoreColor } from '@/lib/colors'
import type { CandidateResult } from '@/lib/types'

function getLeadingNuance(candidats: readonly CandidateResult[]): string {
  if (candidats.length === 0) return ''
  let best = candidats[0]
  for (const c of candidats) {
    if (c.voix > best.voix) best = c
  }
  return best.nuance
}

interface MapProps {
  readonly viewMode: ViewMode
  readonly departements: readonly DepartementSummary[]
  readonly onSelectDepartement: (code: string) => void
  readonly onSelectCommune: (code: string) => void
  readonly activeDepartement: string | null
  readonly plmActive: string | null // e.g. 'plm-75'
  readonly communeResults: readonly CommuneResult[]
  readonly filterNuance: string | null
  readonly competitionFilter: CompetitionFilter
  readonly onHover: (label: string | null) => void
}

function buildFillExpr(
  items: readonly { code: string; color: string }[],
): maplibregl.ExpressionSpecification | string {
  if (items.length === 0) return '#cccccc'
  const expr: unknown[] = ['match', ['get', 'code']]
  for (const item of items) {
    expr.push(item.code, item.color)
  }
  expr.push('#c8c8c0')
  return expr as maplibregl.ExpressionSpecification
}

const DIMMED_COLOR = '#e0e0dc'

function matchesCompetition(c: CommuneResult, filter: CompetitionFilter): boolean {
  if (filter === 'all') return true
  const count = c.candidats.length
  if (filter === 'duel') return count === 2
  if (filter === 'triangulaire') return count >= 3
  return count <= 1 // 'sans'
}

function getCommuneColor(
  c: CommuneResult,
  vm: ViewMode,
  filter: string | null,
  competition: CompetitionFilter,
): string {
  if (vm !== 'parti') return getParticipationColor(c.pourcentageVotants)

  // Competition filter dims non-matching communes
  if (!matchesCompetition(c, competition)) return DIMMED_COLOR

  if (!filter) return getNuanceColor(getLeadingNuance(c.candidats))

  // Gradient mode: color by the filtered party's score
  if (filter === 'SANS') {
    const leading = getLeadingNuance(c.candidats)
    return !leading ? getNuanceColor('') : DIMMED_COLOR
  }
  const candidate = c.candidats.find(cand => cand.nuance === filter)
  if (!candidate) return DIMMED_COLOR
  return getPartyScoreColor(filter, candidate.pourcentageExprimes)
}

export default function Map({
  viewMode,
  departements,
  onSelectDepartement,
  onSelectCommune,
  activeDepartement,
  plmActive,
  communeResults,
  filterNuance,
  competitionFilter,
  onHover,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)

  // Stable refs for callbacks
  const propsRef = useRef({ viewMode, departements, communeResults, filterNuance, competitionFilter, onSelectDepartement, onSelectCommune, onHover })
  propsRef.current = { viewMode, departements, communeResults, filterNuance, competitionFilter, onSelectDepartement, onSelectCommune, onHover }

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#e8ecf1' } },
        ],
      },
      center: [2.5, 46.8],
      zoom: 5.3,
      minZoom: 4,
      maxZoom: 14,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Use empty FeatureCollection initially, then load via fetch
      map.addSource('departements', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      // Load GeoJSON asynchronously
      fetch('/geo/departements.json')
        .then(r => r.json())
        .then(geoData => {
          const src = map.getSource('departements') as maplibregl.GeoJSONSource
          if (src) src.setData(geoData)
        })
        .catch(() => {})
      map.addLayer({
        id: 'departements-fill', type: 'fill', source: 'departements',
        paint: { 'fill-color': '#cccccc', 'fill-opacity': 0.85 },
      })
      map.addLayer({
        id: 'departements-line', type: 'line', source: 'departements',
        paint: { 'line-color': '#ffffff', 'line-width': 1 },
      })

      map.addSource('communes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'communes-fill', type: 'fill', source: 'communes',
        paint: { 'fill-color': '#cccccc', 'fill-opacity': 0.85 },
      })
      map.addLayer({
        id: 'communes-line', type: 'line', source: 'communes',
        paint: { 'line-color': '#ffffff', 'line-width': 0.5 },
      })
      map.setLayoutProperty('communes-fill', 'visibility', 'none')
      map.setLayoutProperty('communes-line', 'visibility', 'none')

      // Click — use a flag to prevent dept click when commune is clicked
      let communeClicked = false
      map.on('click', 'communes-fill', (e) => {
        const code = e.features?.[0]?.properties?.code
        if (code) {
          communeClicked = true
          propsRef.current.onSelectCommune(code)
          setTimeout(() => { communeClicked = false }, 50)
        }
      })
      map.on('click', 'departements-fill', (e) => {
        if (communeClicked) return
        const code = e.features?.[0]?.properties?.code
        if (code) propsRef.current.onSelectDepartement(code)
      })

      // Cursor
      map.on('mouseenter', 'departements-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'departements-fill', () => { map.getCanvas().style.cursor = ''; propsRef.current.onHover(null) })
      map.on('mouseenter', 'communes-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'communes-fill', () => { map.getCanvas().style.cursor = ''; propsRef.current.onHover(null) })

      // Hover
      map.on('mousemove', 'departements-fill', (e) => {
        const code = e.features?.[0]?.properties?.code
        const dept = propsRef.current.departements.find(d => d.codeDepartement === code)
        if (dept) propsRef.current.onHover(`${dept.libelleDepartement} (${dept.codeDepartement}) — ${dept.pourcentageVotants}% participation`)
      })
      map.on('mousemove', 'communes-fill', (e) => {
        const code = e.features?.[0]?.properties?.code
        const commune = propsRef.current.communeResults.find(c => c.codeCommune === code)
        if (!commune) return
        const filter = propsRef.current.filterNuance
        if (filter && filter !== 'SANS') {
          const cand = commune.candidats.find(c => c.nuance === filter)
          const score = cand ? `${cand.pourcentageExprimes}%` : 'absent'
          propsRef.current.onHover(`${commune.libelleCommune} — ${score}`)
        } else {
          propsRef.current.onHover(`${commune.libelleCommune} — ${commune.pourcentageVotants}% participation`)
        }
      })

      readyRef.current = true
    })

    // When data loads, apply current colors
    map.on('sourcedata', () => {
      if (!readyRef.current) return
      const { departements: depts, communeResults: communes, viewMode: vm, filterNuance: filter, competitionFilter: comp } = propsRef.current
      try {
        const deptColors = depts.map(d => {
          if (vm !== 'parti') return { code: d.codeDepartement, color: getParticipationColor(d.pourcentageVotants) }
          const matches = !filter || d.nuanceDominante === filter
          return { code: d.codeDepartement, color: matches ? getNuanceColor(d.nuanceDominante) : DIMMED_COLOR }
        })
        map.setPaintProperty('departements-fill', 'fill-color', buildFillExpr(deptColors))

        if (communes.length > 0) {
          const communeColors = communes.map(c => ({
            code: c.codeCommune,
            color: getCommuneColor(c, vm, filter, comp),
          }))
          map.setPaintProperty('communes-fill', 'fill-color', buildFillExpr(communeColors))
        }
      } catch { /* not ready */ }
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; readyRef.current = false }
  }, [])

  // Update colors when viewMode/departements/communeResults/filterNuance change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    try {
      const deptColors = departements.map(d => {
        if (viewMode !== 'parti') return { code: d.codeDepartement, color: getParticipationColor(d.pourcentageVotants) }
        const matches = !filterNuance || d.nuanceDominante === filterNuance
        return { code: d.codeDepartement, color: matches ? getNuanceColor(d.nuanceDominante) : DIMMED_COLOR }
      })
      map.setPaintProperty('departements-fill', 'fill-color', buildFillExpr(deptColors))

      if (communeResults.length > 0) {
        const communeColors = communeResults.map(c => ({
          code: c.codeCommune,
          color: getCommuneColor(c, viewMode, filterNuance, competitionFilter),
        }))
        map.setPaintProperty('communes-fill', 'fill-color', buildFillExpr(communeColors))
      }
    } catch { /* not ready */ }
  }, [viewMode, departements, communeResults, filterNuance, competitionFilter])

  // Drill-down
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    if (activeDepartement) {
      // Use PLM GeoJSON if drilling into arrondissements
      const geoUrl = plmActive
        ? `/geo/communes/${plmActive}.json`
        : `/geo/communes/${activeDepartement}.json`

      fetch(geoUrl)
        .then(res => res.json())
        .then(data => {
          const source = map.getSource('communes') as maplibregl.GeoJSONSource
          if (source) source.setData(data)

          map.setLayoutProperty('communes-fill', 'visibility', 'visible')
          map.setLayoutProperty('communes-line', 'visibility', 'visible')
          map.setPaintProperty('departements-fill', 'fill-opacity', 0.15)
          map.setPaintProperty('departements-line', 'line-width', 2)
          map.setPaintProperty('departements-line', 'line-color', '#334155')

          const bounds = new maplibregl.LngLatBounds()
          for (const feature of data.features) {
            const walk = (coords: number[][]) => { for (const c of coords) bounds.extend(c as [number, number]) }
            if (feature.geometry.type === 'Polygon') {
              for (const ring of feature.geometry.coordinates) walk(ring)
            } else if (feature.geometry.type === 'MultiPolygon') {
              for (const poly of feature.geometry.coordinates) for (const ring of poly) walk(ring)
            }
          }
          map.fitBounds(bounds, { padding: 40, duration: 800 })
        })
        .catch(() => {})
    } else {
      map.setLayoutProperty('communes-fill', 'visibility', 'none')
      map.setLayoutProperty('communes-line', 'visibility', 'none')
      map.setPaintProperty('departements-fill', 'fill-opacity', 0.85)
      map.setPaintProperty('departements-line', 'line-width', 1)
      map.setPaintProperty('departements-line', 'line-color', '#ffffff')
      const source = map.getSource('communes') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'FeatureCollection', features: [] })
      map.flyTo({ center: [2.5, 46.8], zoom: 5.3, duration: 800 })
    }
  }, [activeDepartement, plmActive])

  return <div ref={containerRef} className="w-full h-full" />
}
