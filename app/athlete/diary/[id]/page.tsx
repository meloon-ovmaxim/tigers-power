'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

const RPE_LABELS: Record<string, string> = {
  failed: 'Не смог', hard: 'Тяжело (1–2 в запасе)',
  medium: 'Средне (3–5 в запасе)', easy: 'Легко (6+ в запасе)'
}

export default function AthleteDiaryDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [day, setDay] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [sess, setSess] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: dayData } = await supabase
        .from('workout_days')
        .select(`*, blocks:workout_blocks(*, block_exercises(*, exercise:exercises(name), sets(*)))`)
        .eq('id', id).single()

      const allBeIds: string[] = []
      dayData?.blocks?.forEach((b: any) => b.block_exercises?.forEach((be: any) => allBeIds.push(be.id)))

      const [{ data: allLogs }, { data: sessions }] = await Promise.all([
        allBeIds.length > 0 ? supabase.from('set_logs').select('*').in('be_id', allBeIds).order('logged_at') : Promise.resolve({ data: [] }),
        supabase.from('workout_sessions').select('*').eq('day_id', id).order('started_at', { ascending: false }).limit(1),
      ])
      setDay(dayData); setLogs(allLogs ?? []); setSess(sessions?.[0] ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><Spinner /></div>
  if (!day) return <div className="page"><div className="content">Не найдено</div></div>

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {new Date(day.date+'T00:00:00').toLocaleDateString('ru',{day:'numeric',month:'long'})}
        </span>
        <div style={{ width: 60 }} />
      </div>
      <div className="content">
        <div style={{ marginBottom: 12 }}>
          {day.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}
        </div>
        {sess && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="stat-box"><div className="stat-num">{sess.total_sets}</div><div className="stat-label">подх.</div></div>
            <div className="stat-box"><div className="stat-num">{day.blocks?.flatMap((b: any) => b.block_exercises).length}</div><div className="stat-label">упр.</div></div>
            <div className="stat-box"><div className="stat-num">{(sess.total_volume_kg/1000).toFixed(1)}т</div><div className="stat-label">объём</div></div>
          </div>
        )}
        {day.blocks?.map((block: any) =>
          block.block_exercises?.map((be: any) => {
            const beLogs = logs.filter(l => l.be_id === be.id)
            return (
              <div key={be.id} className="ex-block">
                <div className="ex-block-header">
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{be.exercise?.name}</div>
                  <span className={`badge ${beLogs.length > 0 ? 'badge-green' : 'badge-gray'}`}>{beLogs.length > 0 ? 'Выполнено' : 'Нет данных'}</span>
                </div>
                <div className="ex-block-body">
                  {beLogs.map((log: any, i: number) => (
                    <div key={log.id} className="set-row">
                      <div className={`set-num ${log.skipped ? '' : 'set-num-done'}`}>{log.skipped ? '—' : i+1}</div>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>
                        {log.skipped ? <span style={{ color: 'var(--text3)' }}>Пропущен</span> : <>{log.actual_reps} × {log.actual_weight} кг{log.rpe_value && ` · ${RPE_LABELS[log.rpe_value]}`}</>}
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
