'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

interface SetDraft {
  id?: string
  reps: string
  weight_kg: string
  weight_pct: string
  rest_sec: string
  rpe_enabled: boolean
  is_warmup: boolean
  isNew?: boolean
}

export default function EditExercise() {
  const router = useRouter()
  const params = useParams()
  const beId = Array.isArray(params.beid) ? params.beid[0] : (params.beid as string)
  const workoutId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [loading, setLoading] = useState(true)
  const [exerciseName, setExerciseName] = useState('')
  const [comment, setComment] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [sets, setSets] = useState<SetDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!beId) return
    const supabase = createClient()
    async function load() {
      const { data } = await supabase
        .from('block_exercises')
        .select('*, exercise:exercises(name), sets(*)')
        .eq('id', beId)
        .single()
      if (!data) { setLoading(false); return }
      setExerciseName(data.exercise?.name ?? '')
      setComment(data.coach_comment ?? '')
      setVideoUrl(data.video_url ?? '')
      const sorted = (data.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
      setSets(sorted.map((s: any) => ({
        id: s.id,
        reps: s.reps ? String(s.reps) : '',
        weight_kg: s.weight_kg ? String(s.weight_kg) : '',
        weight_pct: s.weight_pct ? String(s.weight_pct) : '',
        rest_sec: s.rest_sec ? String(s.rest_sec) : '60',
        rpe_enabled: s.rpe_enabled ?? false,
        is_warmup: s.is_warmup ?? false,
      })))
      setLoading(false)
    }
    load()
  }, [beId])

  function updateSet(idx: number, field: keyof SetDraft, value: any) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function addSet() {
    const last = sets[sets.length - 1]
    setSets(prev => [...prev, {
      reps: last?.reps ?? '',
      weight_kg: last?.weight_kg ?? '',
      weight_pct: last?.weight_pct ?? '',
      rest_sec: last?.rest_sec ?? '90',
      rpe_enabled: false,
      is_warmup: false,
      isNew: true,
    }])
  }

  function removeSet(idx: number) {
    if (sets.length <= 1) return
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    // Update block_exercise (comment, video)
    await supabase.from('block_exercises').update({
      coach_comment: comment || null,
      video_url: videoUrl || null,
    }).eq('id', beId)

    // Delete all existing sets and recreate
    await supabase.from('sets').delete().eq('be_id', beId)

    const setsToInsert = sets.map((s, i) => ({
      be_id: beId,
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

  async function handleDelete() {
    if (!confirm(`Удалить «${exerciseName}» из тренировки?`)) return
    setDeleting(true)
    const supabase = createClient()
    // Get block_id first
    const { data: be } = await supabase
      .from('block_exercises').select('block_id').eq('id', beId).single()
    if (be?.block_id) {
      await supabase.from('workout_blocks').delete().eq('id', be.block_id)
    }
    router.back()
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{exerciseName}</span>
        <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>

      <div className="content">

        {/* Видео */}
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

        {/* Комментарий */}
        <div className="form-group">
          <label className="label">Комментарий тренера</label>
          <textarea className="textarea" placeholder="Техника, рекомендации..."
            value={comment} onChange={e => setComment(e.target.value)} />
        </div>

        {/* Подходы */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Подходы</div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sets.length} подх.</span>
        </div>

        {sets.map((s, idx) => (
          <div key={idx} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'var(--accentbg)', border: '1px solid var(--accentbdr)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent2)',
                }}>{idx + 1}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={s.is_warmup}
                    onChange={e => updateSet(idx, 'is_warmup', e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  Разминочный
                </label>
              </div>
              {sets.length > 1 && (
                <button onClick={() => removeSet(idx)}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>
                  ×
                </button>
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

        <button className="btn btn-outline btn-full" style={{ justifyContent: 'center', marginBottom: 24 }} onClick={addSet}>
          + Ещё подход
        </button>

        {/* Удалить упражнение */}
        <div className="divider" />
        <button
          className="btn btn-danger btn-full"
          style={{ justifyContent: 'center' }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Удаляем...' : `🗑 Удалить «${exerciseName}» из тренировки`}
        </button>
      </div>
    </div>
  )
}
