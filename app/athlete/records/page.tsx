'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Avatar, Spinner } from '@/components/ui'

export default function AthleteRecords() {
  const router = useRouter()
  const [myPms, setMyPms] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('coach_id').eq('id', session.user.id).single()
      const coachId = prof?.coach_id

      const [{ data: pms }, { data: teammates }] = await Promise.all([
        supabase.from('personal_maxes').select('*, exercise:exercises(name)').eq('athlete_id', session.user.id).order('weight_kg', { ascending: false }),
        coachId ? supabase.from('profiles').select('id').eq('coach_id', coachId) : Promise.resolve({ data: [] }),
      ])

      const teammateIds = (teammates ?? []).map((t: any) => t.id)
      const { data: allPms } = await supabase
        .from('personal_maxes')
        .select('*, exercise:exercises(name), athlete:profiles!athlete_id(name)')
        .in('athlete_id', [...teammateIds, session.user.id])
        .order('achieved_at', { ascending: false })
        .limit(20)

      setMyPms(pms ?? [])
      setFeed(allPms ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="topbar"><h1>Рекорды</h1></div>
      <div className="content">
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Мои максимумы</div>
        {myPms.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Рекордов пока нет</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {myPms.map(pm => (
              <div key={pm.id} className="card" style={{ cursor: 'default' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{pm.exercise?.name}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--accent2)' }}>{pm.weight_kg} кг</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{pm.achieved_at}</div>
              </div>
            ))}
          </div>
        )}

        <div className="divider" />
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, margin: '14px 0 10px' }}>Лента — все подопечные</div>
        {feed.map(pm => (
          <div key={pm.id} className="record-row">
            <Avatar name={pm.athlete?.name ?? '?'} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{pm.athlete?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {pm.exercise?.name} <strong style={{ color: 'var(--accent2)' }}>{pm.weight_kg}×1</strong>
              </div>
            </div>
            <span className="badge badge-amber">+ПМ</span>
          </div>
        ))}
      </div>
      <AthleteNav />
    </div>
  )
}
