import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://aozlegtymbxoiqitiunu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function mergeRounds(t1Id, t2Id, mergedId, label) {
  console.log(`\n=== ${label} ===`)

  // Get T2 communes (they take priority)
  const t2Communes = new Set()
  let page = 0
  while (true) {
    const { data } = await sb.from('resultats_vote').select('code_commune')
      .eq('election_id', t2Id).range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    data.forEach(d => t2Communes.add(d.code_commune))
    if (data.length < 1000) break
    page++
  }
  console.log(`T2 communes: ${t2Communes.size}`)

  // Copy T2 resultats_vote
  page = 0
  let copiedRV = 0
  while (true) {
    const { data } = await sb.from('resultats_vote').select('*')
      .eq('election_id', t2Id).range(page * 500, (page + 1) * 500 - 1)
    if (!data || data.length === 0) break
    const rows = data.map(({ id, ...rest }) => ({ ...rest, election_id: mergedId }))
    const { error } = await sb.from('resultats_vote').insert(rows)
    if (error) console.log('  RV T2 error:', error.message)
    else copiedRV += rows.length
    if (data.length < 500) break
    page++
  }
  console.log(`Copied T2 resultats_vote: ${copiedRV}`)

  // Copy T1 resultats_vote (only communes NOT in T2)
  page = 0
  let copiedRV_T1 = 0
  while (true) {
    const { data } = await sb.from('resultats_vote').select('*')
      .eq('election_id', t1Id).range(page * 500, (page + 1) * 500 - 1)
    if (!data || data.length === 0) break
    const rows = data
      .filter(d => !t2Communes.has(d.code_commune))
      .map(({ id, ...rest }) => ({ ...rest, election_id: mergedId }))
    if (rows.length > 0) {
      const { error } = await sb.from('resultats_vote').insert(rows)
      if (error) console.log('  RV T1 error:', error.message)
      else copiedRV_T1 += rows.length
    }
    if (data.length < 500) break
    page++
  }
  console.log(`Copied T1 resultats_vote: ${copiedRV_T1}`)
  console.log(`Total resultats_vote: ${copiedRV + copiedRV_T1}`)

  // Copy T2 candidatures
  page = 0
  let copiedCand = 0
  while (true) {
    const { data } = await sb.from('candidatures').select('*')
      .eq('election_id', t2Id).range(page * 500, (page + 1) * 500 - 1)
    if (!data || data.length === 0) break
    const rows = data.map(({ id, ...rest }) => ({ ...rest, election_id: mergedId }))
    const { error } = await sb.from('candidatures').insert(rows)
    if (error) console.log('  Cand T2 error:', error.message)
    else copiedCand += rows.length
    if (data.length < 500) break
    page++
  }
  console.log(`Copied T2 candidatures: ${copiedCand}`)

  // Copy T1 candidatures (only communes NOT in T2)
  page = 0
  let copiedCand_T1 = 0
  while (true) {
    const { data } = await sb.from('candidatures').select('*')
      .eq('election_id', t1Id).range(page * 500, (page + 1) * 500 - 1)
    if (!data || data.length === 0) break
    const rows = data
      .filter(d => !t2Communes.has(d.code_commune))
      .map(({ id, ...rest }) => ({ ...rest, election_id: mergedId }))
    if (rows.length > 0) {
      const { error } = await sb.from('candidatures').insert(rows)
      if (error) console.log('  Cand T1 error:', error.message)
      else copiedCand_T1 += rows.length
    }
    if (data.length < 500) break
    page++
  }
  console.log(`Copied T1 candidatures: ${copiedCand_T1}`)
  console.log(`Total candidatures: ${copiedCand + copiedCand_T1}`)
}

// 2026: T1=4, T2=5, merged=6
await mergeRounds(4, 5, 6, 'Municipales 2026 - Résultat final')

// 2020: T1=1, T2=2, merged=7
await mergeRounds(1, 2, 7, 'Municipales 2020 - Résultat final')

console.log('\n=== Done ===')
