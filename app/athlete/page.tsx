'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Avatar, Spinner } from '@/components/ui'

function getWeekDates(offset: number = 0) {
  const now = new Date()
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }
const DOW: Record<number, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' }

export default function AthleteHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [days, setDays] = useState<any[]>([])
  // Set of day IDs that have a finished session
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    const { monday, sunday } = getWeekDates(weekOffset)

    // Load workout days for the week
    supabase.from('workout_days').select('*')
      .eq('athlete_id', profile.id)
      .gte('date', fmt(monday))
      .lte('date', fmt(sunday))
      .order('date')
      .then(async ({ data: daysData }) => {
        setDays(daysData ?? [])

        if (!daysData || daysData.length === 0) return

        // Load completed sessions for these days
        const dayIds = daysData.map((d: any) => d.id)
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('day_id')
          .in('day_id', dayIds)
          .not('finished_at', 'is', null)

        const done = new Set((sessions ?? []).map((s: any) => s.day_id))
        setCompletedIds(done)
      })
  }, [profile, weekOffset])

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )

  const { monday, sunday } = getWeekDates(weekOffset)
  const weekLabel = `${monday.getDate()} ${monday.toLocaleDateString('ru', { month: 'short' })} — ${sunday.getDate()} ${sunday.toLocaleDateString('ru', { month: 'short' })}`
  const todayStr = fmt(new Date())

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 18 ? 'Привет' : 'Добрый вечер'},
          </div>
          <h1>{profile?.name?.split(' ')[0]}</h1>
        </div>
        <Avatar name={profile?.name ?? '?'} />
      </div>

      <div className="content">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'var(--greenbg)', border: '1px solid var(--greenbdr)', color: 'var(--green)', fontSize: 11, fontWeight: 600, marginBottom: 14 }}>
          👤 Подопечный
        </div>

        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>‹ Пред</button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>{weekLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>След ›</button>
        </div>

        {days.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗓</div>
            <div>На эту неделю тренировок нет</div>
          </div>
        ) : days.map((day: any) => {
          const dateObj = new Date(day.date + 'T00:00:00')
          const isToday = day.date === todayStr
          const isPast = day.date < todayStr
          const isCompleted = completedIds.has(day.id)

          return (
            <div key={day.id}
              className={`card card-clickable${isToday && !isCompleted ? ' card-accent' : ''}`}
              style={isPast && !isToday && !isCompleted ? { opacity: .65 } : {}}
              onClick={() => router.push(`/athlete/workout/${day.id}`)}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: isToday && !isCompleted ? 'var(--accent2)' : 'var(--text2)', fontWeight: isToday ? 600 : 400 }}>
                  {DOW[dateObj.getDay()]} {dateObj.getDate()} {dateObj.toLocaleDateString('ru', { month: 'short' })}
                  {isToday && !isCompleted && ' · Сегодня'}
                </div>
                {/* Completed badge */}
                {isCompleted && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: 'var(--greenbg)', color: 'var(--green)',
                    border: '1px solid var(--greenbdr)',
                  }}>
                    ✓ Выполнено
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                {day.name ?? 'Тренировка'}
              </div>
              <div>
                {day.focus_tags?.map((t: string) => (
                  <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <AthleteNav />
    </div>
  )
}
