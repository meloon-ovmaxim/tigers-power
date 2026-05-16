'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton, Spinner, IconPlus, IconLayers, IconDots, IconTrending } from '@/components/ui'
import type { FullWorkoutDay } from '@/types'

export default function WorkoutEditor() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [day, setDay] = useState<FullWorkoutDay | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadDay() {
    const supabase = createClient()
    const { data } = await supabase
      .from('workout_days')
      .select(`
        *,
        blocks:workout_blocks(
          *,
          block_exercises(
            *,
            exercise:exercises(name, video_url),
            sets(*)
          )
        )
      `)
      .eq('id', id)
      .single()
    if (data) {
      // sort blocks and exercises by position
      data.blocks = (data.blocks ?? []).sort((a: any, b: any) => a.position - b.position)
      data.blocks.forEach((b: any) => {
        b.block_exercises = (b.block_exercises ?? []).sort((a: any, b: any) => a.position - b.position)
        b.block_exercises.forEach((be: any) => {
          be.sets = (be.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
        })
      })
      setDay(data as any)
    }
    setLoading(false)
  }

  useEffect(() => { loadDay() }, [id])

  if (loading) return <div className="page"><Spinner /></div>
  if (!day) return <div className="page"><div className="content">Тренировка не найдена</div></div>

  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('ru', {
    weekday: 'short', day: 'numeric', month: 'short'
  })

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{day.name ?? 'Тренировка'} · {dateLabel}</span>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {/* Tags */}
        <div style={{ marginBottom: 14 }}>
          {day.focus_tags?.map(t => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}
        </div>

        {/* Blocks */}
        {(day.blocks ?? []).length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Упражнений пока нет. Добавь первое ниже.
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost"
                  onClick={() => router.push(`/coach/workout/${id}/block/${block.id}`)}>
                  <IconDots />
                </button>
              </div>
            </div>
            <div className="ex-block-body">
              {block.block_exercises?.map((be: any) => (
                <div key={be.id} style={{ marginBottom: block.type === 'superset' ? 10 : 0 }}>
                  {block.type === 'superset' && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{be.exercise?.name}</div>
                  )}
                  {be.sets?.map((s: any) => (
                    <div key={s.id} className="set-row">
                      <div className={`set-num${s.is_warmup ? ' set-num-done' : ''}`}>{s.set_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>
                        {s.reps ? `${s.reps} повт` : s.duration_sec ? `${s.duration_sec} сек` : ''}
                        {s.weight_kg ? ` · ${s.weight_kg} кг` : s.weight_pct ? ` · ${s.weight_pct}%ПМ` : s.load_tag ? ` · ${s.load_tag}` : ''}
                        {s.rest_sec ? ` · ${s.rest_sec}с отдых` : ''}
                        {s.rpe_enabled ? ' · RPE' : ''}
                      </div>
                    </div>
                  ))}
                  {be.is_passthrough && (
                    <div style={{ marginTop: 6 }}>
                      <span className="passthrough-label">⚡ Проходка{be.pt_instruction ? `: ${be.pt_instruction}` : ''}</span>
                    </div>
                  )}
                  {be.coach_comment && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>💬 {be.coach_comment}</div>
                  )}
                </div>
              ))}

              {block.type === 'superset' && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  Отдых внутри: {block.rest_between_ex_sec}с · Между кругами: {block.rest_between_rounds_sec}с · {block.rounds} круга
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => router.push(`/coach/workout/${id}/add-exercise`)}>
            <IconPlus /> Упражнение
          </button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => router.push(`/coach/workout/${id}/add-superset`)}>
            <IconLayers /> Суперсет
          </button>
        </div>
      </div>
    </div>
  )
}
