'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  BackButton, Avatar, SectionTitle, Spinner,
  IconPlus, IconEdit, IconChevronLeft, IconChevronRight
} from '@/components/ui'
import type { Profile, WorkoutDay, PersonalMax } from '@/types'

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export default function AthleteDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [athlete, setAthlete] = useState<Profile | null>(null)
  const [tab, setTab] = useState<'program'|'diary'|'records'>('program')
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([])
  const [pms, setPms] = useState<(PersonalMax & { exercise: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: athl }, { data: days }, { data: pmData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('workout_days').select('*').eq('athlete_id', id).order('date'),
        supabase.from('personal_maxes').select('*, exercise:exercises(name)').eq('athlete_id', id).order('achieved_at', { ascending: false }),
      ])
      setAthlete(athl)
      setWorkoutDays(days ?? [])
      setPms(pmData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="page"><Spinner /></div>

  // Calendar helpers
  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = lastDay.getDate()
  const today = new Date()

  function dateStr(d: number) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function getDay(d: number) {
    return workoutDays.find(w => w.date === dateStr(d))
  }

  function handleDayClick(d: number) {
    const ds = dateStr(d)
    const existing = workoutDays.find(w => w.date === ds)
    if (existing) {
      router.push(`/coach/workout/${existing.id}`)
    } else {
      router.push(`/coach/athlete/${id}/new-workout?date=${ds}`)
    }
  }

  // filter current month workouts for program list
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const thisMonthDays = workoutDays.filter(w => w.date.startsWith(monthStr))

  return (
    <div className="page">
      <div className="topbar">
        <BackButton onClick={() => router.back()} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>{athlete?.name}</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {/* Athlete header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={athlete?.name ?? '?'} size="lg" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{athlete?.name}</div>
            <span className="badge badge-green">Активен</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div className={`tab${tab==='program'?' active':''}`} onClick={() => setTab('program')}>Программа</div>
          <div className={`tab${tab==='diary'?' active':''}`} onClick={() => setTab('diary')}>Дневник</div>
          <div className={`tab${tab==='records'?' active':''}`} onClick={() => setTab('records')}>Рекорды</div>
        </div>

        {/* ── PROGRAM TAB ── */}
        {tab === 'program' && (
          <div>
            {/* Month nav */}
            <div className="row" style={{ marginBottom: 8 }}>
              <button className="btn btn-sm" onClick={() => setCalDate(new Date(year, month-1, 1))}>
                <IconChevronLeft />
              </button>
              <span style={{ fontWeight: 600 }}>{MONTHS[month]} {year}</span>
              <button className="btn btn-sm" onClick={() => setCalDate(new Date(year, month+1, 1))}>
                <IconChevronRight />
              </button>
            </div>

            {/* Day headers */}
            <div className="cal-grid" style={{ marginBottom: 4 }}>
              {DAYS.map(d => <div key={d} className="cal-header-day">{d}</div>)}
            </div>

            {/* Calendar */}
            <div className="cal-grid" style={{ marginBottom: 12 }}>
              {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => {
                const ds = dateStr(d)
                const hasDay = getDay(d)
                const isToday = ds === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
                return (
                  <div key={d}
                    className={`cal-day${hasDay?' cal-day-has':''}${isToday?' cal-day-today':''}`}
                    onClick={() => handleDayClick(d)}
                    title={hasDay ? hasDay.name ?? 'Тренировка' : 'Добавить тренировку'}
                  >
                    {d}
                    {hasDay && <div className="cal-dot" />}
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Нажми на день — открыть или создать тренировку
            </div>

            {/* List of this month workouts */}
            {thisMonthDays.map(w => (
              <div key={w.id} className="card card-clickable" onClick={() => router.push(`/coach/workout/${w.id}`)}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
                  {new Date(w.date + 'T00:00:00').toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{w.name ?? 'Тренировка'}</div>
                <div>{w.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── DIARY TAB ── */}
        {tab === 'diary' && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
              Выполненные тренировки
            </div>
            {workoutDays.filter(w => {
              // show only past days
              return new Date(w.date) <= new Date()
            }).reverse().slice(0, 20).map(w => (
              <div key={w.id} className="card card-clickable"
                onClick={() => router.push(`/coach/diary/${w.id}`)}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
                  {new Date(w.date + 'T00:00:00').toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{w.name ?? 'Тренировка'}</div>
                <div>{w.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === 'records' && (
          <div>
            <div className="row" style={{ marginBottom: 10 }}>
              <SectionTitle>Разовые максимумы</SectionTitle>
              <button className="btn btn-sm btn-primary"
                onClick={() => router.push(`/coach/athlete/${id}/add-pm`)}>
                <IconPlus /> Добавить
              </button>
            </div>
            {pms.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Максимумы не заданы</div>
            ) : pms.map(pm => (
              <div key={pm.id} className="record-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{pm.exercise?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {pm.source === 'passthrough' ? '🔥 проходка' : '✍️ вручную'} · {pm.achieved_at}
                  </div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent2)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pm.weight_kg} кг
                </span>
                <button className="btn btn-sm btn-ghost"
                  onClick={() => router.push(`/coach/athlete/${id}/edit-pm/${pm.id}`)}>
                  <IconEdit />
                </button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, background: 'var(--bg3)', padding: '8px 10px', borderRadius: 8 }}>
              Рекорды из проходки обновляются автоматически
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
