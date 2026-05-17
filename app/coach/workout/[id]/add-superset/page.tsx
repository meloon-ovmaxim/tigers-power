'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface ExItem { exercise_id: string; exercise_name: string; sets: number; reps: string; weight_kg: string }

export default function AddSuperset() {
  const router = useRouter()
  const { id: workoutId } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<any[]>([])
  const [items, setItems] = useState<ExItem[]>([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [restBetweenEx, setRestBetweenEx] = useState('0')
  const [restBetweenRounds, setRestBetweenRounds] = useState('90')
  const [rounds, setRounds] = useState('3')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) && !items.find(i => i.exercise_id === e.id)
  ).slice(0, 6)

  function addExercise(ex: any) {
    setItems(prev => [...prev, { exercise_id: ex.id, exercise_name: ex.name, sets: 3, reps: '12', weight_kg: '' }])
    setSearch(''); setShowSearch(false)
  }

  function updateItem(idx: number, field: keyof ExItem, value: any) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSave() {
    if (items.length < 2) { alert('Добавь минимум 2 упражнения'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: existing } = await supabase.from('workout_blocks').select('position').eq('day_id', workoutId).order('position', { ascending: false }).limit(1)
    const pos = (existing?.[0]?.position ?? -1) + 1
    const { data: block } = await supabase.from('workout_blocks').insert({ day_id: workoutId, type: 'superset', position: pos, rest_between_ex_sec: parseInt(restBetweenEx)||0, rest_between_rounds_sec: parseInt(restBetweenRounds)||90, rounds: parseInt(rounds)||3 }).select().single()
    if (!block) { setSaving(false); return }
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { data: be } = await supabase.from('block_exercises').insert({ block_id: block.id, exercise_id: item.exercise_id, position: i }).select().single()
      if (!be) continue
      await supabase.from('sets').insert(Array.from({ length: item.sets }, (_, si) => ({ be_id: be.id, set_number: si+1, reps: item.reps ? parseInt(item.reps) : null, weight_kg: item.weight_kg ? parseFloat(item.weight_kg) : null, rest_sec: 0, rpe_enabled: false })))
    }
    router.back()
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Суперсет</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={items.length < 2 || saving}>{saving ? '...' : 'Сохранить'}</button>
      </div>
      <div className="content">
        <div className="info-box">Упражнения выполняются подряд, потом отдых между кругами.</div>

        {items.map((item, idx) => (
          <div key={idx} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}>{idx+1}</div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{item.exercise_name}</span>
              </div>
              <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div className="grid-3">
              <div><label className="label">Подходов</label><input className="input" style={{ margin: 0 }} placeholder="3" value={item.sets} onChange={e => updateItem(idx, 'sets', parseInt(e.target.value)||1)} /></div>
              <div><label className="label">Повторений</label><input className="input" style={{ margin: 0 }} placeholder="12" value={item.reps} onChange={e => updateItem(idx, 'reps', e.target.value)} /></div>
              <div><label className="label">Вес (кг)</label><input className="input" style={{ margin: 0 }} placeholder="40" value={item.weight_kg} onChange={e => updateItem(idx, 'weight_kg', e.target.value)} /></div>
            </div>
          </div>
        ))}

        {showSearch ? (
          <div className="form-group">
            <input className="input" autoFocus placeholder="Поиск упражнения..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <div className="suggest-list">{filtered.map(e => <div key={e.id} className="suggest-item" onClick={() => addExercise(e)}>{e.name}</div>)}</div>}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSearch(false)}>Отмена</button>
          </div>
        ) : (
          <button className="btn btn-outline btn-full" style={{ justifyContent: 'center', marginBottom: 16 }} onClick={() => setShowSearch(true)}>+ Добавить упражнение в серию</button>
        )}

        <div className="divider" />
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Настройки серии</div>
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <div className="form-group"><label className="label">Отдых внутри (сек)</label><input className="input" placeholder="0" value={restBetweenEx} onChange={e => setRestBetweenEx(e.target.value)} /></div>
          <div className="form-group"><label className="label">Между кругами (сек)</label><input className="input" placeholder="90" value={restBetweenRounds} onChange={e => setRestBetweenRounds(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="label">Кол-во кругов</label><input className="input" placeholder="3" value={rounds} onChange={e => setRounds(e.target.value)} /></div>
      </div>
    </div>
  )
}
