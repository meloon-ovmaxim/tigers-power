'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CoachNav, Avatar, Spinner } from '@/components/ui'

export default function CoachHome() {
  const router = useRouter()
  const [coach, setCoach] = useState<any>(null)
  const [athletes, setAthletes] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setCoach(profile)
      const { data: athl } = await supabase.from('profiles').select('*').eq('coach_id', session.user.id).eq('role', 'athlete')
      setAthletes(athl ?? [])
      if (athl && athl.length > 0) {
        const ids = athl.map((a: any) => a.id)
        const { data: recs } = await supabase
          .from('personal_maxes')
          .select('*, exercise:exercises(name), athlete:profiles!athlete_id(name)')
          .in('athlete_id', ids)
          .order('achieved_at', { ascending: false })
          .limit(5)
        setRecords(recs ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><Spinner /></div>

  const h = new Date().getHours()
  const greeting = h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{greeting},</div>
          <h1>{coach?.name}</h1>
        </div>
        <span className="role-chip role-chip-coach">🛡 Тренер</span>
      </div>

      <div className="content">
        {/* Athletes */}
        <div className="section-title">Подопечные</div>
        {athletes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 24 }}>
            Пока нет подопечных.<br />Добавь первого в разделе профиля.
          </div>
        ) : athletes.map((a: any) => (
          <div key={a.id} className="card card-clickable" onClick={() => router.push(`/coach/athlete/${a.id}`)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={a.name} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Подопечный</div>
                </div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>
            </div>
          </div>
        ))}

        {/* Records feed */}
        {records.length > 0 && (
          <>
            <div className="section-title">Лента рекордов</div>
            {records.map((r: any) => (
              <div key={r.id} className="record-row">
                <Avatar name={r.athlete?.name ?? '?'} size="sm" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.athlete?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {r.exercise?.name} <strong style={{ color: 'var(--accent2)' }}>{r.weight_kg}×1</strong>
                  </div>
                </div>
                <span className="badge badge-accent">Рекорд</span>
              </div>
            ))}
          </>
        )}
      </div>
      <CoachNav />
    </div>
  )
}
