'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton, IconTrending } from '@/components/ui'

export default function AddExercise() {
  const router = useRouter()
  const { id: workoutId } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [weightPct, setWeightPct] = useState('')
  const [restSec, setRestSec] = useState('90')
  const [rpeEnabled, setRpeEnabled] = useState(false)
  const [comment, setComment] = useState('')
  const [isPassthrough, setIsPassthrough] = useState(false)
  const [ptInstruction, setPtInstruction] = useState('')
  const [ptWarmupReps, setPtWarmupReps] = useState('5')
  const [ptWarmupWeight, setPtWarmupWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()

    // Get current max position
    const { data: existing } = await supabase
      .from('workout_blocks')
      .select('position')
      .eq('day_id', workoutId)
      .order('position', { ascending: false })
      .limit(1)
    const pos = existing?.[0]?.position ?? -1

    // Create block
    const { data: block } = await supabase
      .from('workout_blocks')
      .insert({ day_id: workoutId, type: 'single', position: pos + 1 })
      .select().single()
    if (!block) { setSaving(false); return }

    // Create block_exercise
    const { data: be } = await supabase
      .from('block_exercises')
      .insert({
        block_id: block.id,
        exercise_id: selected.id,
        position: 0,
        coach_comment: comment || null,
        is_passthrough: isPassthrough,
        pt_instruction: isPassthrough ? ptInstruction : null,
      })
      .select().single()
    if (!be) { setSaving(false); return }

    // Create sets
    const setsToInsert = []

    if (isPassthrough) {
      // warmup set
      setsToInsert.push({
        be_id: be.id, set_number: 1, reps: parseInt(ptWarmupReps) || 5,
        weight_kg: ptWarmupWeight ? parseFloat(ptWarmupWeight) : null,
        rest_sec: parseInt(restSec) || 90, is_warmup: true, rpe_enabled: false,
      })
    } else {
      for (let i = 1; i <= sets; i++) {
        setsToInsert.push({
          be_id: be.id, set_number: i,
          reps: reps ? parseInt(reps) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          weight_pct: weightPct ? parseInt(weightPct) : null,
          rest_sec: parseInt(restSec) || 60,
          rpe_enabled: i === sets ? rpeEnabled : false,
        })
      }
    }

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
      setCreatingNew(false)
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600 }}>Добавить упражнение</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!selected || saving}>
          {saving ? '...' : 'Добавить'}
        </button>
      </div>

      <div className="content">
        {/* Exercise search */}
        <div className="form-group">
          <label className="label">Упражнение</label>
          <input className="input" placeholder="Начни вводить название..."
            value={search} onChange={e => { setSearch(e.target.value); setSelected(null) }} />
          {search.length > 0 && !selected && (
            <div className="suggest-list">
              {filtered.slice(0,6).map(e => (
                <div key={e.id} className="suggest-item" onClick={() => { setSelected(e); setSearch(e.name) }}>
                  {e.name}
                </div>
              ))}
              <div className="suggest-item" style={{ color: 'var(--accent2)' }}
                onClick={() => { setCreatingNew(true); setNewExName(search) }}>
                + Создать "{search}"
              </div>
            </div>
          )}
          {creatingNew && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input" style={{ margin: 0 }} value={newExName}
                onChange={e => setNewExName(e.target.value)} placeholder="Название упражнения" />
              <button className="btn btn-sm btn-primary" onClick={createNewExercise}>OK</button>
            </div>
          )}
        </div>

        {selected && (
          <>
            <div style={{ padding: '8px 12px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: 'var(--accent2)', fontWeight: 600 }}>
              ✓ {selected.name}
            </div>

            {/* Passthrough toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', marginBottom: 16, cursor: 'pointer' }}
              onClick={() => setIsPassthrough(!isPassthrough)}>
              <input type="checkbox" checked={isPassthrough} onChange={() => {}} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>⚡ Режим проходки</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Пользователь добавляет рабочие подходы сам</div>
              </div>
            </div>

            {isPassthrough ? (
              <>
                <div className="info-box" style={{ background: '#052E1620', borderColor: '#14532D' }}>
                  Разминочный подход задаёшь ты. Рабочие — добавляет пользователь до предела. RPE обязателен.
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">Разм. повторений</label>
                    <input className="input" placeholder="5" value={ptWarmupReps} onChange={e => setPtWarmupReps(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Разм. вес (кг/%ПМ)</label>
                    <input className="input" placeholder="60 / 50%" value={ptWarmupWeight} onChange={e => setPtWarmupWeight(e.target.value)} />
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
                <div className="grid-2" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label className="label">Подходов</label>
                    <input className="input" type="number" min={1} placeholder="3"
                      value={sets} onChange={e => setSets(parseInt(e.target.value)||1)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Повторений</label>
                    <input className="input" placeholder="10" value={reps} onChange={e => setReps(e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">Вес (кг)</label>
                    <input className="input" placeholder="80" value={weightKg} onChange={e => setWeightKg(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">или % ПМ</label>
                    <input className="input" placeholder="75" value={weightPct} onChange={e => setWeightPct(e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">Отдых (сек)</label>
                    <input className="input" placeholder="90" value={restSec} onChange={e => setRestSec(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ paddingTop: 22 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={rpeEnabled} onChange={e => setRpeEnabled(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                      RPE на последнем
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="label">Комментарий тренера</label>
              <textarea className="textarea" placeholder="Техника, рекомендации..."
                value={comment} onChange={e => setComment(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
