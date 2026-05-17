'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

const RPE_LABELS: Record<string, string> = {
  failed: 'Не смог',
  hard: 'Тяжело (1–2 в запасе)',
  medium: 'Средне (3–5 в запасе)',
  easy: 'Легко (6+ в запасе)',
}

export default function CoachDiaryDetail() {
  const router = useRouter()
  const params = useParams()
  // FIX: explicit string cast
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [day, setDay] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [sess, setSess] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    async function load() {
      const { data: dayData } = await supabase
        .from('workout_days')
        .select(`
          *,
          athlete:profiles!athlete_id(name),
          blocks:workout_blocks(*,
            block_exercises(*,
              exercise:exercises(name),
              sets(*)
            )
          )
        `)
        .eq('id', id)
        .single()

      // FIX: collect all be_ids properly
      const allBeIds: string[] = []
      dayData?.blocks?.forEach((b: any) => {
        b.block_exercises?.forEach((be: any) => {
          if (be.id) allBeIds.push(be.id)
        })
      })

      const [{ data: allLogs }, { data: sessions }] = await Promise.all([
        allBeIds.length > 0
          ? supabase.from('set_logs').select('*').in('be_id', allBeIds).order('logged_at')
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('workout_sessions').select('*').eq('day_id', id)
          .order('started_at', { ascending: false }).limit(1),
      ])

      setDay(dayData)
      setLogs(allLogs ?? [])
      setSess(sessions?.[0] ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )
  if (!day) return <div className="page"><div className="content">Не найдено</div></div>

  const exerciseCount = day.blocks?.flatMap((b: any) => b.block_exercises ?? []).length ?? 0

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{day.athlete?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {new Date(day.date+'T00:00:00').toLocaleDateString('ru',{day:'numeric',month:'long'})}
          </div>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        <div style={{ marginBottom: 12 }}>
          {day.focus_tags?.map((t: string) => (
            <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
          ))}
        </div>

        {sess ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="stat-box"><div className="stat-num">{sess.total_sets}</div><div className="stat-label">подх.</div></div>
            <div className="stat-box"><div className="stat-num">{exerciseCount}</div><div className="stat-label">упр.</div></div>
            <div className="stat-box"><div className="stat-num">{(sess.total_volume_kg/1000).toFixed(1)}т</div><div className="stat-label">объём</div></div>
          </div>
        ) : (
          <div style={{ background: 'var(--amberbg)', border: '1px solid var(--amberbdr)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>
            Тренировка ещё не выполнялась
          </div>
        )}

        {day.blocks?.map((block: any) =>
          block.block_exercises?.map((be: any) => {
            const beLogs = logs.filter((l: any) => l.be_id === be.id)
            return (
              <div key={be.id} className="ex-block">
                <div className="ex-block-header">
                  <div>
                    {block.type === 'superset' && <div className="superset-label" style={{ marginBottom: 3 }}>Суперсет</div>}
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{be.exercise?.name}</div>
                  </div>
                  <span className={`badge ${beLogs.length > 0 ? 'badge-green' : 'badge-gray'}`}>
                    {beLogs.length > 0 ? 'Выполнено' : 'Нет данных'}
                  </span>
                </div>
                <div className="ex-block-body">
                  {beLogs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Подходы не записаны</div>
                  ) : beLogs.map((log: any, i: number) => (
                    <div key={log.id} className="set-row">
                      <div className={`set-num${log.skipped ? '' : ' set-num-done'}`}>
                        {log.skipped ? '—' : i+1}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>
                        {log.skipped ? (
                          <span style={{ color: 'var(--text3)' }}>Пропущен</span>
                        ) : (
                          <>
                            {log.actual_reps} × {log.actual_weight} кг
                            {log.rpe_value && ` · ${RPE_LABELS[log.rpe_value]}`}
                            {log.is_passthrough && ' · проходка'}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
