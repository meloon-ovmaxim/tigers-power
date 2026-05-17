'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton } from '@/components/ui'

interface SetDraft {
  reps: string
  weight_kg: string
  weight_pct: string
  rest_sec: string
  rpe_enabled: boolean
  is_warmup: boolean
}

function emptySet(): SetDraft {
  return { reps: '', weight_kg: '', weight_pct: '', rest_sec: '90', rpe_enabled: false, is_warmup: false }
}

export default function AddExercise() {
  const router = useRouter()
  const { id: workoutId } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [sets, setSets] = useState<SetDraft[]>([emptySet(), emptySet(), emptySet()])
  const [comment, setComment] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [isPassthrough, setIsPassthrough] = useState(false)
  const [ptInstruction, setPtInstruction] = useState('')
  const [ptWarmupReps, setPtWarmupReps] = useState('5')
  const [ptWarmupWeight, setPtWarmupWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [showNewEx, setShowNewEx] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)

  function updateSet(idx: number, field: keyof SetDraft, value: any) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function addSet() {
    setSets(prev => [...prev, emptySet()])
  }

  function removeSet(idx: number) {
    if (sets.length <= 1) return
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('workout_blocks')
      .select('position')
      .eq('day_id', workoutId)
      .order('position', { ascending: false })
      .limit(1)
    const pos = (existing?.[0]?.position ?? -1) + 1

    const { data: block } = await supabase
      .from('workout_blocks')
      .insert({ day_id: workoutId, type: 'single', position: pos })
      .select().single()
    if (!block) { setSaving(false); return }

    const { data: be } = await supabase
      .from('block_exercises')
      .insert({
        block_id: block.id,
        exercise_id: selected.id,
        position: 0,
        coach_comment: comment || null,
        video_url: videoUrl || null,
        is_passthrough: isPassthrough,
        pt_instruction: isPassthrough ? ptInstruction : null,
      })
      .select().single()
    if (!be) { setSaving(false); return }

    const setsToInsert = isPassthrough
      ? [{
          be_id: be.id, set_number: 1,
          reps: parseInt(ptWarmupReps) || 5,
          weight_kg: ptWarmupWeight ? parseFloat(ptWarmupWeight) : null,
          rest_sec: 90, is_warmup: true, rpe_enabled: false,
        }]
      : sets.map((s, i) => ({
          be_id: be.id,
          set_number: i + 1,
          reps: s.reps ? parseInt(s.reps) : null,
          weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
          weight_pct: s.weight_pct ? parseInt(s.weight_pct) : null,
          rest_sec: s.rest_sec ? parseInt(s.rest_sec) : 60,
          rpe_enabled: s.rpe_enabled,
          is_warmup: s.is_warmup,
        }))

    await supabase.from('sets').insert(setsToInsert)
    router.back()
  }

  async function createNewExercise() {
    if (!newExName.trim()) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase
      .from('exercises')
      .insert({ name: newExName.trim(), created_by: session?.user.id })
      .select().single()
    if (data) {
      setExercises(prev => [...prev, data])
      setSelected(data)
      setSearch(data.name)
      setShowNewEx(false)
      setNewExName('')
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Добавить упражнение</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!selected || saving}>
          {saving ? '...' : 'Сохранить'}
        </button>
      </div>

      <div className="content">
        {/* Exercise search */}
        <div className="form-group">
          <label className="label">Упражнение</label>
          <input className="input" placeholder="Начни вводить название..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (selected) setSelected(null) }}
          />
          {search.length > 0 && !selected && (
            <div className="suggest-list">
              {filtered.map(e => (
                <div key={e.id} className="suggest-item"
                  onClick={() => { setSelected(e); setSearch(e.name) }}>
                  {e.name}
                </div>
              ))}
              <div className="suggest-item" style={{ color: 'var(--accent2)' }}
                onClick={() => { setShowNewEx(true); setNewExName(search) }}>
                + Создать «{search}»
              </div>
            </div>
          )}
          {showNewEx && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input" style={{ margin: 0 }} value={newExName}
                onChange={e => setNewExName(e.target.value)}
                placeholder="Название упражнения" />
              <button className="btn btn-sm btn-primary" onClick={createNewExercise}>OK</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowNewEx(false)}>✕</button>
            </div>
          )}
        </div>

        {selected && (
          <>
            <div style={{
              padding: '8px 12px', background: 'var(--accentbg)',
              border: '1px solid var(--accentbdr)', borderRadius: 'var(--radius)',
              marginBottom: 16, fontSize: 13, color: 'var(--accent2)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              ✓ {selected.name}
            </div>

            {/* Video URL */}
            <div className="form-group">
              <label className="label">Видео-инструкция (ссылка)</label>
              <input className="input" placeholder="https://youtube.com/..."
                value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="video-link" style={{ marginTop: 6, display: 'inline-flex' }}>
                  ▶ Открыть видео
                </a>
              )}
            </div>

            {/* Passthrough toggle */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'var(--bg3)',
                borderRadius: 'var(--radius)', marginBottom: 16, cursor: 'pointer',
                border: isPassthrough ? '1px solid var(--accentbdr)' : '1px solid var(--border)',
              }}
              onClick={() => setIsPassthrough(!isPassthrough)}
            >
              <input type="checkbox" checked={isPassthrough} onChange={() => {}}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>⚡ Режим проходки</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Подопечный добавляет рабочие подходы сам</div>
              </div>
            </div>

            {isPassthrough ? (
              <>
                <div className="info-box-blue">
                  Ты задаёшь разминочный подход. Рабочие — добавляет подопечный до предела. RPE обязателен.
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Разминочный подход</div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">Повторений</label>
                    <input className="input" placeholder="5" value={ptWarmupReps}
                      onChange={e => setPtWarmupReps(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Вес (кг или %ПМ)</label>
                    <input className="input" placeholder="60 / 50%" value={ptWarmupWeight}
                      onChange={e => setPtWarmupWeight(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Инструкция для рабочих подходов</label>
                  <input className="input" placeholder="Напр.: по 3 повтора до предела"
                    value={ptInstruction} onChange={e => setPtInstruction(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                {/* Individual sets */}
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  Подходы
                </div>

                {sets.map((s, idx) => (
                  <div key={idx} className="set-edit-row">
                    <div className="set-edit-row-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="set-edit-num">{idx + 1}</div>
                        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                          {s.is_warmup ? 'Разминочный' : 'Рабочий'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={s.is_warmup}
                            onChange={e => updateSet(idx, 'is_warmup', e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }} />
                          Разм.
                        </label>
                        {sets.length > 1 && (
                          <button className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 7px', color: 'var(--red)' }}
                            onClick={() => removeSet(idx)}>✕</button>
                        )}
                      </div>
                    </div>

                    <div className="grid-2" style={{ marginBottom: 8 }}>
                      <div>
                        <label className="label">Повторений</label>
                        <input className="input" style={{ margin: 0 }} placeholder="10"
                          value={s.reps} onChange={e => updateSet(idx, 'reps', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Вес (кг)</label>
                        <input className="input" style={{ margin: 0 }} placeholder="80"
                          value={s.weight_kg} onChange={e => updateSet(idx, 'weight_kg', e.target.value)} />
                      </div>
                    </div>

                    <div className="grid-2">
                      <div>
                        <label className="label">% от ПМ</label>
                        <input className="input" style={{ margin: 0 }} placeholder="75"
                          value={s.weight_pct} onChange={e => updateSet(idx, 'weight_pct', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Отдых (сек)</label>
                        <input className="input" style={{ margin: 0 }} placeholder="90"
                          value={s.rest_sec} onChange={e => updateSet(idx, 'rest_sec', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={s.rpe_enabled}
                          onChange={e => updateSet(idx, 'rpe_enabled', e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                        <span>Спросить RPE после подхода</span>
                      </label>
                    </div>
                  </div>
                ))}

                <button className="btn btn-outline btn-full" style={{ marginTop: 4, justifyContent: 'center' }}
                  onClick={addSet}>
                  + Добавить подход
                </button>
              </>
            )}

            {/* Comment */}
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="label">Комментарий тренера</label>
              <textarea className="textarea" placeholder="Техника выполнения, рекомендации..."
                value={comment} onChange={e => setComment(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
