'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Avatar, Spinner } from '@/components/ui'

export default function AthleteRecords() {
  const router = useRouter()
  const [myPms, setMyPms] = useState<any[]>([])
  const [ptRecords, setPtRecords] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const uid = session.user.id

      const { data: prof } = await supabase
        .from('profiles').select('coach_id').eq('id', uid).single()
      const coachId = prof?.coach_id

      const [{ data: pms }, { data: teammates }] = await Promise.all([
        supabase.from('personal_maxes')
          .select('*, exercise:exercises(name)')
          .eq('athlete_id', uid)
          .order('weight_kg', { ascending: false }),
        coachId
          ? supabase.from('profiles').select('id').eq('coach_id', coachId)
          : Promise.resolve({ data: [] as any[] }),
      ])

      // Passthrough records: last set per exercise that is NOT 'failed'
      // We join set_logs → block_exercises → exercises
      const { data: ptLogs } = await supabase
        .from('set_logs')
        .select(`
          id, actual_reps, actual_weight, rpe_value, logged_at,
          block_exercise:block_exercises!be_id(
            exercise:exercises(id, name)
          )
        `)
        .eq('athlete_id', uid)
        .eq('is_passthrough', true)
        .neq('rpe_value', 'failed')
        .not('actual_weight', 'is', null)
        .order('logged_at', { ascending: false })

      // Group by exercise — keep only the latest per exercise
      const seenExercises = new Set<string>()
      const lastPtPerExercise: any[] = []
      for (const log of ptLogs ?? []) {
        const exId = log.block_exercise?.exercise?.id
        if (!exId || seenExercises.has(exId)) continue
        seenExercises.add(exId)
        lastPtPerExercise.push({
          exerciseId: exId,
          exerciseName: log.block_exercise?.exercise?.name,
          reps: log.actual_reps,
          weight: log.actual_weight,
          rpe: log.rpe_value,
          date: log.logged_at?.split('T')[0],
        })
      }
      setPtRecords(lastPtPerExercise)

      // Feed: all teammates + self PMs
      const teammateIds = (teammates ?? []).map((t: any) => t.id)
      const { data: allPms } = await supabase
        .from('personal_maxes')
        .select('*, exercise:exercises(name), athlete:profiles!athlete_id(name)')
        .in('athlete_id', [...teammateIds, uid])
        .order('achieved_at', { ascending: false })
        .limit(20)

      setMyPms(pms ?? [])
      setFeed(allPms ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><Spinner /></div>

  const RPE_LABELS: Record<string, string> = {
    hard: 'Тяжело', medium: 'Средне', easy: 'Легко'
  }
  const RPE_COLORS: Record<string, string> = {
    hard: '#F59E0B', medium: '#4D78FF', easy: '#22C55E'
  }

  return (
    <div className="page">
      <div className="topbar"><h1>Рекорды</h1></div>
      <div className="content">

        {/* ── Личные максимумы (ПМ) ── */}
        <div className="section-title">Личные максимумы</div>
        {myPms.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Рекордов пока нет</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {myPms.map(pm => (
              <div key={pm.id} className="card" style={{ cursor: 'default' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{pm.exercise?.name}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--accent2)' }}>
                  {pm.weight_kg} кг
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{pm.achieved_at}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Последние подходы проходки ── */}
        {ptRecords.length > 0 && (
          <>
            <div className="section-title">Последние рабочие подходы</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              Последний выполненный подход проходки по каждому упражнению
            </div>
            {ptRecords.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                marginBottom: 6,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.exerciseName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {r.reps} × {r.weight} кг · {r.date}
                  </div>
                </div>
                {r.rpe && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: `${RPE_COLORS[r.rpe] ?? '#4D78FF'}22`,
                    color: RPE_COLORS[r.rpe] ?? '#4D78FF',
                    border: `1px solid ${RPE_COLORS[r.rpe] ?? '#4D78FF'}44`,
                  }}>
                    {RPE_LABELS[r.rpe] ?? r.rpe}
                  </span>
                )}
              </div>
            ))}
            <div className="divider" />
          </>
        )}

        {/* ── Лента всех подопечных ── */}
        <div className="section-title">Лента — все подопечные</div>
        {feed.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Нет данных</div>
        ) : feed.map(pm => (
          <div key={pm.id} className="record-row">
            <Avatar name={pm.athlete?.name ?? '?'} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{pm.athlete?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {pm.exercise?.name} <strong style={{ color: 'var(--accent2)' }}>{pm.weight_kg}×1</strong>
              </div>
            </div>
            <span className="badge badge-amber">+ПМ</span>
          </div>
        ))}
      </div>
      <AthleteNav />
    </div>
  )
}
