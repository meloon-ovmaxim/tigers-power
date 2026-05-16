'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Avatar, Spinner } from '@/components/ui'
import type { Profile, WorkoutDay } from '@/types'

function getWeekDates(offset: number = 0) {
  const now = new Date()
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

const WEEKDAY_LABELS: Record<number, string> = { 1:'Пн', 2:'Вт', 3:'Ср', 4:'Чт', 5:'Пт', 6:'Сб', 0:'Вс' }

export default function AthleteHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [days, setDays] = useState<WorkoutDay[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    const { monday, sunday } = getWeekDates(weekOffset)
    supabase
      .from('workout_days')
      .select('*')
      .eq('athlete_id', profile.id)
      .gte('date', fmt(monday))
      .lte('date', fmt(sunday))
      .order('date')
      .then(({ data }) => setDays(data ?? []))
  }, [profile, weekOffset])

  if (loading) return <div className="page"><Spinner /></div>

  const { monday, sunday } = getWeekDates(weekOffset)
  const weekLabel = `${monday.getDate()} ${monday.toLocaleDateString('ru',{month:'short'})} — ${sunday.getDate()} ${sunday.toLocaleDateString('ru',{month:'short'})}`
  const todayStr = fmt(new Date())

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Привет'
    return 'Добрый вечер'
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{greeting()},</div>
          <h1>{profile?.name?.split(' ')[0]}</h1>
        </div>
        <Avatar name={profile?.name ?? '?'} />
      </div>

      <div className="content">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'var(--greenbg)', border: '1px solid var(--greenbdr)', color: 'var(--green)', fontSize: 11, fontWeight: 600, marginBottom: 14 }}>
          👤 Подопечный
        </div>

        {/* Week nav */}
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setWeekOffset(w => w-1)}>← Пред</button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>{weekLabel}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setWeekOffset(w => w+1)}>След →</button>
        </div>

        {days.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗓</div>
            <div>На эту неделю тренировок нет</div>
          </div>
        ) : days.map(day => {
          const dateObj = new Date(day.date + 'T00:00:00')
          const dow = dateObj.getDay()
          const dowLabel = WEEKDAY_LABELS[dow]
          const isToday = day.date === todayStr
          const isPast = day.date < todayStr

          return (
            <div key={day.id}
              className={`card card-clickable${isToday ? ' card-accent' : ''}`}
              style={isPast && !isToday ? { opacity: .65 } : {}}
              onClick={() => router.push(`/athlete/workout/${day.id}`)}>
              <div style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text2)', marginBottom: 4, fontWeight: isToday ? 600 : 400 }}>
                {dowLabel} {dateObj.getDate()} {dateObj.toLocaleDateString('ru',{month:'short'})}
                {isToday && ' · Сегодня'}
                {isPast && !isToday && ' · Выполнено'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{day.name ?? 'Тренировка'}</div>
              <div>{day.focus_tags?.map(t => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</div>
            </div>
          )
        })}
      </div>

      <AthleteNav />
    </div>
  )
}
