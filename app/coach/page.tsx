'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CoachNav, Avatar, IconChevronRight, Spinner, SectionTitle } from '@/components/ui'
import type { Profile } from '@/types'

export default function CoachHome() {
  const router = useRouter()
  const [coach, setCoach] = useState<Profile | null>(null)
  const [athletes, setAthletes] = useState<Profile[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const [{ data: profile }, { data: athl }, { data: recs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('profiles').select('*').eq('coach_id', session.user.id).eq('role', 'athlete'),
        supabase
          .from('personal_maxes')
          .select('*, exercise:exercises(name), athlete:profiles!athlete_id(name)')
          .in('athlete_id', (await supabase.from('profiles').select('id').eq('coach_id', session.user.id)).data?.map((p:any) => p.id) ?? [])
          .order('achieved_at', { ascending: false })
          .limit(5),
      ])
      setCoach(profile)
      setAthletes(athl ?? [])
      setRecords(recs ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="page"><Spinner /></div>

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{greeting()},</div>
          <h1>{coach?.name}</h1>
        </div>
        <span className="role-chip role-chip-coach">🛡 Тренер</span>
      </div>

      <div className="content">
        <SectionTitle>Подопечные</SectionTitle>
        {athletes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 24 }}>
            Пока нет подопечных.<br/>Создай первого в разделе профиля.
          </div>
        ) : athletes.map(a => (
          <div key={a.id} className="card card-clickable"
            onClick={() => router.push(`/coach/athlete/${a.id}`)}>
            <div className="flex-center" style={{ justifyContent: 'space-between' }}>
              <div className="flex-center">
                <Avatar name={a.name} />
                <div>
                  <div style={{ fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Подопечный</div>
                </div>
              </div>
              <span style={{ color: 'var(--text3)', width: 20, height: 20 }}><IconChevronRight /></span>
            </div>
          </div>
        ))}

        {records.length > 0 && <>
          <SectionTitle>Лента рекордов</SectionTitle>
          {records.map((r: any) => (
            <div key={r.id} className="record-row">
              <Avatar name={r.athlete?.name ?? '?'} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.athlete?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {r.exercise?.name} <strong style={{ color: 'var(--accent2)' }}>{r.weight_kg}×1</strong>
                </div>
              </div>
              <span className="badge badge-accent">Рекорд</span>
            </div>
          ))}
        </>}
      </div>

      <CoachNav />
    </div>
  )
}
