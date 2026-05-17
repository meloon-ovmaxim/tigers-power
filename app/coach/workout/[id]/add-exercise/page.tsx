'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface SetDraft {
  reps: string
  weight_kg: string
  weight_pct: string
  rest_sec: string
  rpe_enabled: boolean
  is_warmup: boolean
}

interface WarmupDraft {
  reps: string
  weight: string
}

function emptySet(prev?: SetDraft): SetDraft {
  return {
    reps: prev?.reps ?? '',
    weight_kg: prev?.weight_kg ?? '',
    weight_pct: prev?.weight_pct ?? '',
    rest_sec: prev?.rest_sec ?? '90',
    rpe_enabled: false,
    is_warmup: prev?.is_warmup ?? false,
  }
}

export default function AddExercise() {
  const router = useRouter()
  const { id: workoutId } = useParams<{ id: string }>()

  const [exercises, setExercises] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [sets, setSets] = useState<SetDraft[]>([emptySet()])
  const [comment, setComment] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [isPassthrough, setIsPassthrough] = useState(false)
  const [ptInstruction, setPtInstruction] = useState('')
  // FIX 7: multiple warmup sets
  const [warmups, setWarmups] = useState<WarmupDraft[]>([{ reps: '5', weight: '' }])
  const [saving, setSaving] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [showNewEx, setShowNewEx] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name')
      .then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8)

  function updateSet(idx: number, field: keyof SetDraft, value: any) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function addSet() {
    setSets(prev => [...prev, emptySet(prev[prev.length - 1])])
  }

  function removeSet(idx: number) {
    if (sets.length <= 1) return
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  function updateWarmup(idx: number, field: keyof WarmupDraft, value: string) {
    setWarmups(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w))
  }

  function addWarmup() {
    setWarmups(prev => [...prev, { reps: '5', weight: '' }])
  }

  function removeWarmup(idx: number) {
    if (warmups.length <= 1) return
    setWarmups(prev => prev.filter((_, i) => i !== idx))
  }

  async function createNewExercise() {
    if (!newExName.trim()) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('exercises')
      .insert({ name: newExName.trim(), created_by: session?.user.id })
      .select().single()
    if (data) {
      setExercises(prev => [...prev, data])
      setSelected(data)
      setSearch(data.name)
      setShowNewEx(false)
      setNewExName('')
      setShowSearch(false)
    }
  }

  async function handleSave() {
    if (!selected) { alert('Выбери упражнение'); return }
    setSaving(true)
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('workout_blocks').select('position')
      .eq('day_id', workoutId)
      .order('position', { ascending: false }).limit(1)
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

    // FIX 7: insert all warmup sets
    const setsToInsert = isPassthrough
      ? warmups.map((w, i) => ({
          be_id: be.id,
          set_number: i + 1,
          reps: w.reps ? parseInt(w.reps) : 5,
          weight_kg: w.weight ? parseFloat(w.weight) : null,
          weight_pct: null,
          rest_sec: 90,
          is_warmup: true,
          rpe_enabled: false,
        }))
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

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Добавить упражнение</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!selected || saving}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>

      <div className="content">
        {/* Exercise search */}
        <div className="form-group">
          <label className="label">Упражнение</label>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, padding: '10px 12px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 'var(--radius)', fontSize: 14, color: 'var(--accent2)', fontWeight: 600 }}>
                ✓ {selected.name}
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => { setSelected(null); setSearch('') }}>Изменить</button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Начни вводить название..." value={search} autoFocus
                onChange={e => { setSearch(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)} />
              {showSearch && search.length > 0 && (
                <div className="suggest-list">
                  {filtered.map(e => (
                    <div key={e.id} className="suggest-item"
                      onMouseDown={() => { setSelected(e); setSearch(e.name); setShowSearch(false) }}>
                      {e.name}
                    </div>
                  ))}
                  <div className="suggest-item" style={{ color: 'var(--accent2)' }}
                    onMouseDown={() => { setShowNewEx(true); setNewExName(search); setShowSearch(false) }}>
                    + Создать «{search}»
                  </div>
                </div>
              )}
              {showNewEx && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="input" style={{ margin: 0 }} value={newExName}
                    onChange={e => setNewExName(e.target.value)} placeholder="Название" />
                  <button className="btn btn-sm btn-primary" onClick={createNewExercise}>OK</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowNewEx(false)}>✕</button>
                </div>
              )}
            </>
          )}
        </div>

        {selected && (
          <>
            {/* Video */}
            <div className="form-group">
              <label className="label">Видео-инструкция (ссылка)</label>
              <input className="input" placeholder="https://youtube.com/..."
                value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--accent2)', padding: '4px 10px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 8, textDecoration: 'none' }}>
                  ▶ Открыть видео
                </a>
              )}
            </div>

            {/* Passthrough toggle */}
            <div onClick={() => setIsPassthrough(!isPassthrough)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 'var(--radius)', marginBottom: 16, cursor: 'pointer',
              background: isPassthrough ? 'var(--accentbg)' : 'var(--bg3)',
              border: `1px solid ${isPassthrough ? 'var(--accentbdr)' : 'var(--border)'}`,
              transition: 'all .15s',
            }}>
              <input type="checkbox" checked={isPassthrough} onChange={() => {}}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>⚡ Режим проходки</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Подопечный добавляет рабочие подходы сам</div>
              </div>
            </div>

            {isPassthrough ? (
              <>
                <div style={{ background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, color: 'var(--accent3)', marginBottom: 14 }}>
                  Ты задаёшь разминочные подходы. Рабочие добавляет подопечный до предела. RPE обязателен.
                </div>

                {/* FIX 7: Multiple warmup sets */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Разминочные подходы</div>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{warmups.length} подх.</span>
                </div>

                {warmups.map((w, idx) => (
                  <div key={idx} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--greenbg)', border: '1px solid var(--greenbdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Разминка</span>
                      </div>
                      {warmups.length > 1 && (
                        <button onClick={() => removeWarmup(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                    <div className="grid-2">
                      <div>
                        <label className="label">Повторений</label>
                        <input className="input" style={{ margin: 0 }} placeholder="5"
                          value={w.reps} onChange={e => updateWarmup(idx, 'reps', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Вес (кг или %ПМ)</label>
                        <input className="input" style={{ margin: 0 }} placeholder="60 / 50%"
                          value={w.weight} onChange={e => updateWarmup(idx, 'weight', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                <button className="btn btn-outline btn-full" style={{ justifyContent: 'center', marginBottom: 14 }}
                  onClick={addWarmup}>
                  + Ещё разминочный подход
                </button>

                <div className="form-group">
                  <label className="label">Инструкция для рабочих подходов</label>
                  <input className="input" placeholder="Напр.: по 3 повтора до предела"
                    value={ptInstruction} onChange={e => setPtInstruction(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Подходы</div>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sets.length} подх.</span>
                </div>

                {sets.map((s, idx) => (
                  <div key={idx} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}>
                          {idx + 1}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={s.is_warmup}
                            onChange={e => updateSet(idx, 'is_warmup', e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }} />
                          Разминочный
                        </label>
                      </div>
                      {sets.length > 1 && (
                        <button onClick={() => removeSet(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
                      )}
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

                    <div className="grid-2" style={{ marginBottom: 8 }}>
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

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                      <input type="checkbox" checked={s.rpe_enabled}
                        onChange={e => updateSet(idx, 'rpe_enabled', e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                      Спросить RPE после подхода
                    </label>
                  </div>
                ))}

                <button className="btn btn-outline btn-full" style={{ justifyContent: 'center' }} onClick={addSet}>
                  + Ещё подход
                </button>
              </>
            )}

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
