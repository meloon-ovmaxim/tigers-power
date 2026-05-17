'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

export default function WorkoutEditor() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [day, setDay] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deletingWorkout, setDeletingWorkout] = useState(false)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)

  async function loadDay() {
    const supabase = createClient()
    const { data } = await supabase
      .from('workout_days')
      .select(`
        *,
        blocks:workout_blocks(*,
          block_exercises(*,
            exercise:exercises(name, video_url),
            sets(*)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (data) {
      data.blocks = (data.blocks ?? []).sort((a: any, b: any) => a.position - b.position)
      data.blocks.forEach((b: any) => {
        b.block_exercises = (b.block_exercises ?? []).sort((a: any, b: any) => a.position - b.position)
        b.block_exercises.forEach((be: any) => {
          be.sets = (be.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
        })
      })
      setDay(data)
    }
    setLoading(false)
  }

  useEffect(() => { loadDay() }, [id])

  async function deleteBlock(blockId: string, name: string) {
    if (!confirm(`Удалить «${name}» из тренировки?`)) return
    const supabase = createClient()
    await supabase.from('workout_blocks').delete().eq('id', blockId)
    loadDay()
  }

  async function deleteWorkout() {
    if (!confirm('Удалить всю тренировку? Это действие нельзя отменить.')) return
    setDeletingWorkout(true)
    const supabase = createClient()
    await supabase.from('workout_days').delete().eq('id', id)
    router.back()
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )
  if (!day) return <div className="page"><div className="content">Не найдено</div></div>

  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('ru', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{day.name ?? 'Тренировка'} · {dateLabel}</span>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {/* Теги */}
        <div style={{ marginBottom: 14 }}>
          {day.focus_tags?.map((t: string) => (
            <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
          ))}
        </div>

        {/* Список упражнений */}
        {(day.blocks ?? []).length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Упражнений нет. Добавь первое ниже.
          </div>
        )}

        {(day.blocks ?? []).map((block: any) => {
          const blockName = block.block_exercises?.map((be: any) => be.exercise?.name).join(' + ')
          const isOpen = expandedBlock === block.id

          return (
            <div key={block.id} className="ex-block">
              {/* Заголовок блока */}
              <div className="ex-block-header" style={{ cursor: 'pointer' }}
                onClick={() => setExpandedBlock(isOpen ? null : block.id)}>
                <div style={{ flex: 1 }}>
                  {block.type === 'superset' && (
                    <div className="superset-label" style={{ marginBottom: 4 }}>Суперсет</div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{blockName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {block.block_exercises?.reduce((acc: number, be: any) => acc + (be.sets?.length ?? 0), 0)} подходов
                    {block.block_exercises?.[0]?.video_url && ' · 📹 видео'}
                  </div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 18, marginLeft: 8 }}>
                  {isOpen ? '∧' : '∨'}
                </span>
              </div>

              {/* Детали (раскрываются) */}
              {isOpen && (
                <div className="ex-block-body">
                  {block.block_exercises?.map((be: any) => (
                    <div key={be.id} style={{ marginBottom: block.type === 'superset' ? 12 : 0 }}>
                      {block.type === 'superset' && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>
                          {be.exercise?.name}
                        </div>
                      )}

                      {/* Подходы */}
                      {be.sets?.map((s: any) => (
                        <div key={s.id} className="set-row">
                          <div className={`set-num${s.is_warmup ? ' set-num-done' : ''}`}>
                            {s.set_number}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>
                            {s.reps ? `${s.reps} повт` : ''}
                            {s.weight_kg ? ` · ${s.weight_kg} кг` : s.weight_pct ? ` · ${s.weight_pct}%ПМ` : ''}
                            {s.rest_sec ? ` · ${s.rest_sec}с` : ''}
                            {s.rpe_enabled ? ' · RPE' : ''}
                            {s.is_warmup ? ' · разм.' : ''}
                          </div>
                        </div>
                      ))}

                      {/* Видео и комментарий */}
                      {be.video_url && (
                        <a href={be.video_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--accent2)', padding: '3px 8px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 6, textDecoration: 'none' }}>
                          ▶ Видео
                        </a>
                      )}
                      {be.is_passthrough && (
                        <div style={{ marginTop: 5 }}>
                          <span className="passthrough-label">
                            ⚡ Проходка{be.pt_instruction ? `: ${be.pt_instruction}` : ''}
                          </span>
                        </div>
                      )}
                      {be.coach_comment && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          💬 {be.coach_comment}
                        </div>
                      )}

                      {/* Кнопка редактировать (только для single) */}
                      {block.type === 'single' && (
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ marginTop: 8, fontSize: 11 }}
                          onClick={() => router.push(`/coach/workout/${id}/edit-exercise/${be.id}`)}>
                          ✎ Редактировать подходы
                        </button>
                      )}
                    </div>
                  ))}

                  {block.type === 'superset' && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                      Отдых внутри: {block.rest_between_ex_sec}с · Между кругами: {block.rest_between_rounds_sec}с · {block.rounds} кр.
                    </div>
                  )}

                  {/* Удалить блок */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteBlock(block.id, blockName)}>
                      🗑 Удалить {block.type === 'superset' ? 'суперсет' : 'упражнение'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Кнопки добавления */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => router.push(`/coach/workout/${id}/add-exercise`)}>
            + Упражнение
          </button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => router.push(`/coach/workout/${id}/add-superset`)}>
            ⊞ Суперсет
          </button>
        </div>

        {/* Удалить тренировку */}
        <div style={{ marginTop: 32 }}>
          <div className="divider" />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Опасная зона
          </div>
          <button
            className="btn btn-danger btn-full"
            style={{ justifyContent: 'center' }}
            onClick={deleteWorkout}
            disabled={deletingWorkout}>
            {deletingWorkout ? 'Удаляем...' : '🗑 Удалить всю тренировку'}
          </button>
        </div>
      </div>
    </div>
  )
}
