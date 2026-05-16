'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AthleteNav, Spinner } from '@/components/ui'

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export default function AthleteDiary() {
  const router = useRouter()
  const [athleteId, setAthleteId] = useState('')
  const [workoutDays, setWorkoutDays] = useState<any[]>([])
  const [calDate, setCalDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setAthleteId(session.user.id)
      const today = new Date()
      supabase
        .from('workout_days')
        .select('*')
        .eq('athlete_id', session.user.id)
        .lte('date', today.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .then(({ data }) => { setWorkoutDays(data ?? []); setLoading(false) })
    })
  }, [router])

  if (loading) return <div className="page"><Spinner /></div>

  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  function dateStr(d: number) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  function getDayData(d: number) {
    return workoutDays.find(w => w.date === dateStr(d))
  }

  return (
    <div className="page">
      <div className="topbar"><h1>Дневник</h1></div>
      <div className="content">
        {/* Calendar header */}
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setCalDate(new Date(year, month-1, 1))}>← </button>
          <span style={{ fontWeight: 600 }}>{MONTHS[month]} {year}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setCalDate(new Date(year, month+1, 1))}> →</button>
        </div>
        <div className="cal-grid" style={{ marginBottom: 4 }}>
          {DAYS.map(d => <div key={d} className="cal-header-day">{d}</div>)}
        </div>
        <div className="cal-grid" style={{ marginBottom: 16 }}>
          {Array.from({ length: startOffset }).map((_,i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_,i) => i+1).map(d => {
            const ds = dateStr(d)
            const dayData = getDayData(d)
            const isToday = ds === today.toISOString().split('T')[0]
            const isFuture = new Date(ds) > today
            return (
              <div key={d}
                className={`cal-day${dayData?' cal-day-has':''}${isToday?' cal-day-today':''}`}
                style={isFuture ? { opacity: .3, cursor: 'default' } : {}}
                onClick={() => dayData && router.push(`/athlete/diary/${dayData.id}`)}>
                {d}
                {dayData && <div className="cal-dot" />}
              </div>
            )
          })}
        </div>

        {/* Recent list */}
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
          Последние тренировки
        </div>
        {workoutDays.slice(0,10).map(w => (
          <div key={w.id} className="card card-clickable" onClick={() => router.push(`/athlete/diary/${w.id}`)}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
              {new Date(w.date + 'T00:00:00').toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 5 }}>{w.name ?? 'Тренировка'}</div>
            <div>{w.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</div>
          </div>
        ))}
      </div>
      <AthleteNav />
    </div>
  )
}
