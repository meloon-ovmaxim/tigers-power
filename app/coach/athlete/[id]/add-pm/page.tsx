'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton } from '@/components/ui'

export default function AddPm() {
  const router = useRouter()
  const { id: athleteId } = useParams<{ id: string }>()
  const [exercises, setExercises] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? []))
  }, [])

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave() {
    if (!selected || !weight) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('personal_maxes').upsert({
      athlete_id: athleteId,
      exercise_id: selected.id,
      weight_kg: parseFloat(weight),
      source: 'manual',
      achieved_at: new Date().toISOString().split('T')[0],
    }, { onConflict: 'athlete_id,exercise_id' })
    router.back()
  }

  async function createNew() {
    if (!newName.trim()) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('exercises').insert({ name: newName.trim(), created_by: session?.user.id }).select().single()
    if (data) { setExercises(p => [...p, data]); setSelected(data); setSearch(data.name) }
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600 }}>Добавить максимум</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!selected || !weight || saving}>
          Сохранить
        </button>
      </div>
      <div className="content">
        <div className="form-group">
          <label className="label">Упражнение</label>
          <input className="input" placeholder="Начни вводить..." value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }} />
          {search && !selected && (
            <div className="suggest-list">
              {filtered.slice(0,6).map(e => (
                <div key={e.id} className="suggest-item" onClick={() => { setSelected(e); setSearch(e.name) }}>{e.name}</div>
              ))}
              <div className="suggest-item" style={{ color: 'var(--accent2)' }}
                onClick={() => setNewName(search)}>
                + Создать "{search}"
              </div>
            </div>
          )}
          {newName && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input" style={{ margin: 0 }} value={newName} onChange={e => setNewName(e.target.value)} />
              <button className="btn btn-sm btn-primary" onClick={createNew}>OK</button>
            </div>
          )}
        </div>
        {selected && (
          <div style={{ padding: '8px 12px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--accent2)', fontWeight: 600 }}>
            ✓ {selected.name}
          </div>
        )}
        <div className="form-group">
          <label className="label">Вес (кг)</label>
          <input className="input" type="number" placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Рекорды из режима проходки обновляются автоматически при выполнении 1 повторения с новым максимумом.
        </div>
      </div>
    </div>
  )
}
