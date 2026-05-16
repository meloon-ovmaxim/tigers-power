'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CoachNav, Avatar, Spinner } from '@/components/ui'

export default function CoachProfile() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ athletes: 0, workouts: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      const [{ count: ath }, { count: wd }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('coach_id', session.user.id),
        supabase.from('workout_days').select('*', { count: 'exact', head: true }).eq('coach_id', session.user.id),
      ])
      setStats({ athletes: ath ?? 0, workouts: wd ?? 0 })
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="topbar"><h1>Профиль</h1></div>
      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={profile?.name ?? '?'} size="lg" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{profile?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Тренер</div>
          </div>
        </div>

        <div style={{ background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🛡</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)' }}>Тренер · полный доступ</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Управление подопечными и программами</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div className="stat-box"><div className="stat-num">{stats.athletes}</div><div className="stat-label">подопечных</div></div>
          <div className="stat-box"><div className="stat-num">{stats.workouts}</div><div className="stat-label">тренировок</div></div>
        </div>

        <div className="card card-clickable" style={{ marginBottom: 8 }}
          onClick={() => router.push('/coach/create-athlete')}>
          <div className="row"><span style={{ fontSize: 13 }}>➕ Добавить подопечного</span><span style={{ color: 'var(--text3)' }}>→</span></div>
        </div>
        <div className="card" style={{ cursor: 'default', marginBottom: 8 }}>
          <div className="row"><span style={{ fontSize: 13 }}>Сменить пароль</span><span style={{ color: 'var(--text3)' }}>→</span></div>
        </div>

        <button className="btn btn-danger btn-full" style={{ marginTop: 12 }} onClick={handleLogout}>
          Выйти из аккаунта
        </button>
      </div>
      <CoachNav />
    </div>
  )
}
