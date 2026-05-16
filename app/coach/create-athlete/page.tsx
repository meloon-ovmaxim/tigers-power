'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton } from '@/components/ui'

export default function CreateAthlete() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [coachId, setCoachId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCoachId(session.user.id)
    })
  }, [])

  async function handleCreate() {
    if (!name || !email || !password) { setError('Заполни все поля'); return }
    setSaving(true); setError('')
    // Note: creating users requires admin/service role key
    // For MVP, use Supabase dashboard or Edge Function
    // Here we show the flow but actual user creation needs server action
    const supabase = createClient()
    // In production, call an API route that uses the service role key
    const res = await fetch('/api/create-athlete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, coachId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Ошибка'); setSaving(false); return }
    router.replace('/coach')
  }

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <span style={{ fontWeight: 600 }}>Новый подопечный</span>
        <div style={{ width: 60 }} />
      </div>
      <div className="content">
        <div className="form-group">
          <label className="label">Имя</label>
          <input className="input" placeholder="Иван Иванов" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Email (логин)</label>
          <input className="input" type="email" placeholder="ivan@gym.ru" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Пароль (временный)</label>
          <input className="input" type="password" placeholder="Минимум 6 символов" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && (
          <div style={{ background: 'var(--redbg)', border: '1px solid var(--redbdr)', borderRadius: 'var(--radius)', padding: '10px 12px', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary btn-full btn-large" onClick={handleCreate} disabled={saving}>
          {saving ? 'Создаём...' : 'Создать подопечного'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, textAlign: 'center' }}>
          Пользователь получит логин и пароль от тебя лично.<br />
          При первом входе он может сменить пароль.
        </div>
      </div>
    </div>
  )
}
