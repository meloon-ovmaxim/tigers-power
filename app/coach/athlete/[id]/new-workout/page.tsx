'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton, TagInput, Spinner } from '@/components/ui'

export default function NewWorkout() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [usedTags, setUsedTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [coachId, setCoachId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCoachId(session.user.id)
    })
    // Load previously used tags
    supabase.from('workout_days')
      .select('focus_tags')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const all = (data ?? []).flatMap((d: any) => d.focus_tags ?? [])
        setUsedTags([...new Set(all)])
      })
  }, [])

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('ru', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  async function handleCreate() {
    if (!coachId) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('workout_days')
      .insert({ athlete_id: id, coach_id: coachId, date, name: name || null, focus_tags: tags })
      .select()
      .single()
    if (!error && data) {
      router.replace(`/coach/workout/${data.id}`)
    } else {
      alert('Ошибка при создании тренировки')
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600 }}>{dateLabel}</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="content">
        <h2 style={{ marginBottom: 4 }}>Новая тренировка</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>{dateLabel}</div>

        <div className="form-group">
          <label className="label">Название (необязательно)</label>
          <input className="input" placeholder="Тренировка A" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="label">Теги фокуса дня</label>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            Вводи любой текст и нажимай Enter. Ниже — ранее использованные.
          </div>
          <TagInput tags={tags} onChange={setTags} suggestions={usedTags} />
        </div>

        <button
          className="btn btn-primary btn-full btn-large"
          onClick={handleCreate}
          disabled={saving}
          style={{ marginTop: 8 }}
        >
          {saving ? 'Создаём...' : 'Далее — добавить упражнения →'}
        </button>
      </div>
    </div>
  )
}
