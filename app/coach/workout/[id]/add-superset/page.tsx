'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton } from '@/components/ui'

interface ExInSuperset {
  exercise_id: string
  exercise_name: string
  sets: number
  reps: string
  weight_kg: string
  rest_sec: string
}

export default function AddSuperset() {
  const router = useRouter()
  const { id: workoutId } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<any[]>([])
  const [items, setItems] = useState<ExInSuperset[]>([])
  const [search, setSearch] = useState('')
  const [restBetweenEx, setRestBetweenEx] = useState('0')
  const [restBetweenRounds, setRestBetweenRounds] = useState('90')
  const [rounds, setRounds] = useState('3')
  const [saving, setSaving] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !items.find(i => i.exercise_id === e.id)
  ).slice(0, 6)

  function addExercise(ex: any) {
    setItems(prev => [...prev, {
      exercise_id: ex.id,
      exercise_name: ex.name,
      sets: 3,
      reps: '12',
      weight_kg: '',
      rest_sec: '0',
    }])
    setSearch('')
    setShowSearch(false)
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ExInSuperset, value: any) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSave() {
    if (items.length < 2) { alert('Добавь минимум 2 упражнения в суперсет'); return }
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
      .insert({
        day_id: workoutId,
        type: 'superset',
        position: pos,
        rest_between_ex_sec: parseInt(restBetweenEx) || 0,
        rest_between_rounds_sec: parseInt(restBetweenRounds) || 90,
        rounds: parseInt(rounds) || 3,
      })
      .select().single()
    if (!block) { setSaving(false); return }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { data: be } = await supabase
        .from('block_exercises')
        .insert({ block_id: block.id, exercise_id: item.exercise_id, position: i })
        .select().single()
      if (!be) continue

      const setsToInsert = Array.from({ length: item.sets }, (_, si) => ({
        be_id: be.id,
        set_number: si + 1,
        reps: item.reps ? parseInt(item.reps) : null,
        weight_kg: item.weight_kg ? parseFloat(item.weight_kg) : null,
        rest_sec: parseInt(item.rest_sec) || 0,
        rpe_enabled: false,
      }))
      await supabase.from('sets').insert(setsToInsert)
    }

    router.back()
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Суперсет</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={items.length < 2 || saving}>
          {saving ? '...' : 'Сохранить'}
        </button>
      </div>

      <div className="content">
        <div className="info-box">
          Упражнения выполняются последовательно без остановки, потом отдых между кругами.
        </div>

        {/* Exercises in superset */}
        {items.map((item, idx) => (
          <div key={idx} className="ex-block" style={{ marginBottom: 8 }}>
            <div className="ex-block-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="set-edit-num">{idx + 1}</div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{item.exercise_name}</span>
              </div>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)', padding: '3px 8px' }}
                onClick={() => removeItem(idx)}>✕</button>
            </div>
            <div className="ex-block-body">
              <div className="grid-3">
                <div>
                  <label className="label">Подходов</label>
                  <input className="input" style={{ margin: 0 }} placeholder="3"
                    value={item.sets} onChange={e => updateItem(idx, 'sets', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="label">Повторений</label>
                  <input className="input" style={{ margin: 0 }} placeholder="12"
                    value={item.reps} onChange={e => updateItem(idx, 'reps', e.target.value)} />
                </div>
                <div>
                  <label className="label">Вес (кг)</label>
                  <input className="input" style={{ margin: 0 }} placeholder="40"
                    value={item.weight_kg} onChange={e => updateItem(idx, 'weight_kg', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add exercise to superset */}
        {showSearch ? (
          <div className="form-group">
            <input className="input" autoFocus placeholder="Поиск упражнения..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <div className="suggest-list">
                {filtered.map(e => (
                  <div key={e.id} className="suggest-item" onClick={() => addExercise(e)}>
                    {e.name}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSearch(false)}>Отмена</button>
          </div>
        ) : (
          <button className="btn btn-outline btn-full" style={{ justifyContent: 'center', marginBottom: 16 }}
            onClick={() => setShowSearch(true)}>
            + Добавить упражнение в серию
          </button>
        )}

        <div className="divider" />

        {/* Superset settings */}
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Настройки серии</div>

        <div className="grid-2" style={{ marginBottom: 10 }}>
          <div className="form-group">
            <label className="label">Отдых внутри серии (сек)</label>
            <input className="input" placeholder="0 — без паузы"
              value={restBetweenEx} onChange={e => setRestBetweenEx(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="label">Отдых между кругами (сек)</label>
            <input className="input" placeholder="90"
              value={restBetweenRounds} onChange={e => setRestBetweenRounds(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Количество кругов</label>
          <input className="input" placeholder="3"
            value={rounds} onChange={e => setRounds(e.target.value)} />
        </div>
      </div>
    </div>
  )
}
