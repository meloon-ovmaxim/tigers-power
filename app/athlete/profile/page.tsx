'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Avatar, Spinner } from '@/components/ui'

export default function AthleteProfile() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [coach, setCoach] = useState<any>(null)
  const [stats, setStats] = useState({ sessions: 0, records: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)

      if (prof?.coach_id) {
        const { data: c } = await supabase.from('profiles').select('name').eq('id', prof.coach_id).single()
        setCoach(c)
      }

      const [{ count: sessCount }, { count: pmCount }] = await Promise.all([
        supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('athlete_id', session.user.id).not('finished_at', 'is', null),
        supabase.from('personal_maxes').select('*', { count: 'exact', head: true }).eq('athlete_id', session.user.id),
      ])
      setStats({ sessions: sessCount ?? 0, records: pmCount ?? 0 })
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
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{profile?.id?.slice(0,8)}...</div>
          </div>
        </div>

        <div style={{ background: 'var(--greenbg)', border: '1px solid var(--greenbdr)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Подопечный</div>
            {coach && <div style={{ fontSize: 11, color: 'var(--text2)' }}>Тренер: {coach.name}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div className="stat-box"><div className="stat-num">{stats.sessions}</div><div className="stat-label">тренировок</div></div>
          <div className="stat-box"><div className="stat-num">{stats.records}</div><div className="stat-label">рекордов</div></div>
        </div>

        <div className="card" style={{ cursor: 'default', marginBottom: 8 }}>
          <div className="row"><span style={{ fontSize: 13 }}>Сменить пароль</span><span style={{ color: 'var(--text3)' }}>→</span></div>
        </div>
        <div className="card" style={{ cursor: 'default', marginBottom: 20 }}>
          <div className="row"><span style={{ fontSize: 13 }}>Уведомления</span><span style={{ color: 'var(--text3)' }}>→</span></div>
        </div>

        <button className="btn btn-danger btn-full" onClick={handleLogout}>Выйти из аккаунта</button>
      </div>
      <AthleteNav />
    </div>
  )
}
