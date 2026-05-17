'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    console.log('Trying login with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Неверный логин или пароль'); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Ошибка входа'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    router.replace(profile?.role === 'coach' ? '/coach' : '/athlete')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--accentbg)', border: '1px solid var(--accentbdr)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 32
        }}>🐯</div>
        <div className="logo">TIGERS<span> POWER</span></div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
          Тренировочная платформа
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 360 }}>
        <div className="form-group">
          <label className="label">Логин (email)</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label className="label">Пароль</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div style={{
            background: 'var(--redbg)', border: '1px solid var(--redbdr)',
            borderRadius: 'var(--radius)', padding: '10px 12px',
            color: 'var(--red)', fontSize: 13, marginBottom: 14
          }}>{error}</div>
        )}

        <button type="submit" className="btn btn-primary btn-full btn-large" disabled={loading}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
