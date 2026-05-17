'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

export default function WorkoutEditor() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [day, setDay] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function loadDay() {
    const supabase = createClient()
    const { data } = await supabase
      .from('workout_days')
      .select(`*, blocks:workout_blocks(*, block_exercises(*, exercise:exercises(name,video_url), sets(*)))`)
      .eq('id', id).single()
    if (data) {
      data.blocks = (data.blocks ?? []).sort((a: any, b: any) => a.position - b.position)
      data.blocks.forEach((b: any) => {
        b.block_exercises = (b.block_exercises ?? []).sort((a: any, b: any) => a.position - b.position)
        b.block_exercises.forEach((be: any) => { be.sets = (be.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number) })
      })
      setDay(data)
    }
    setLoading(false)
  }

  useEffect(() => { loadDay() }, [id])

  async function deleteBlock(blockId: string) {
    if (!confirm('Удалить упражнение?')) return
    const supabase = createClient()
    await supabase.from('workout_blocks').delete().eq('id', blockId)
    loadDay()
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><Spinner /></div>
  if (!day) return <div className="page"><div className="content">Не найдено</div></div>

  const dateLabel = new Date(day.date+'T00:00:00').toLocaleDateString('ru',{weekday:'short',day:'numeric',month:'short'})

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{day.name ?? 'Тренировка'} · {dateLabel}</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="content">
        <div style={{ marginBottom: 14 }}>
          {day.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}
        </div>

        {(day.blocks ?? []).length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Упражнений нет. Добавь первое.
          </div>
        )}

        {(day.blocks ?? []).map((block: any) => (
          <div key={block.id} className="ex-block">
            <div className="ex-block-header">
              <div>
                {block.type === 'superset' && <div className="superset-label" style={{ marginBottom: 4 }}>Суперсет</div>}
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {block.block_exercises?.map((be: any) => be.exercise?.name).join(' + ')}
                </div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => deleteBlock(block.id)}>Удалить</button>
            </div>
            <div className="ex-block-body">
              {block.block_exercises?.map((be: any) => (
                <div key={be.id} style={{ marginBottom: block.type === 'superset' ? 10 : 0 }}>
                  {block.type === 'superset' && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 600 }}>{be.exercise?.name}</div>}
                  {be.sets?.map((s: any) => (
                    <div key={s.id} className="set-row">
                      <div className={`set-num${s.is_warmup ? ' set-num-done' : ''}`}>{s.set_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>
                        {s.reps ? `${s.reps} повт` : ''}{s.weight_kg ? ` · ${s.weight_kg} кг` : s.weight_pct ? ` · ${s.weight_pct}%ПМ` : ''}{s.rest_sec ? ` · ${s.rest_sec}с` : ''}{s.rpe_enabled ? ' · RPE' : ''}{s.is_warmup ? ' · разм.' : ''}
                      </div>
                    </div>
                  ))}
                  {be.is_passthrough && <div style={{ marginTop: 6 }}><span className="passthrough-label">⚡ Проходка{be.pt_instruction ? `: ${be.pt_instruction}` : ''}</span></div>}
                  {be.video_url && <a href={be.video_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 11, color: 'var(--accent2)', padding: '3px 8px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 6, textDecoration: 'none' }}>▶ Видео</a>}
                  {be.coach_comment && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>💬 {be.coach_comment}</div>}
                </div>
              ))}
              {block.type === 'superset' && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Отдых внутри: {block.rest_between_ex_sec}с · Между кругами: {block.rest_between_rounds_sec}с · {block.rounds} кр.</div>}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => router.push(`/coach/workout/${id}/add-exercise`)}>
            + Упражнение
          </button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => router.push(`/coach/workout/${id}/add-superset`)}>
            ⊞ Суперсет
          </button>
        </div>
      </div>
    </div>
  )
}
