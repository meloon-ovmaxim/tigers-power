'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Avatar, Spinner } from '@/components/ui'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

export default function AthleteDetail() {
  const router = useRouter()
  const params = useParams()
  // FIX: explicit string cast to avoid string[] issue
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [athlete, setAthlete] = useState<any>(null)
  const [tab, setTab] = useState<'program'|'diary'|'records'>('program')
  const [workoutDays, setWorkoutDays] = useState<any[]>([])
  const [pms, setPms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calDate, setCalDate] = useState(new Date())

  useEffect(() => {
    if (!id) return
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

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )

  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  function dateStr(d: number) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  function getDayData(d: number) {
    return workoutDays.find(w => w.date === dateStr(d))
  }
  function handleDayClick(d: number) {
    const ds = dateStr(d)
    const existing = workoutDays.find(w => w.date === ds)
    if (existing) {
      router.push(`/coach/workout/${existing.id as string}`)
    } else {
      router.push(`/coach/athlete/${id}/new-workout?date=${ds}`)
    }
  }

  const monthDays = workoutDays.filter(w =>
    w.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)
  )

  return (
    <div className="page">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{athlete?.name}</span>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={athlete?.name ?? '?'} size="lg" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{athlete?.name}</div>
            <span className="badge badge-green">Активен</span>
          </div>
        </div>

        <div className="tabs">
          <div className={`tab${tab==='program'?' active':''}`} onClick={() => setTab('program')}>Программа</div>
          <div className={`tab${tab==='diary'?' active':''}`} onClick={() => setTab('diary')}>Дневник</div>
          <div className={`tab${tab==='records'?' active':''}`} onClick={() => setTab('records')}>Рекорды</div>
        </div>

        {/* ── PROGRAM ── */}
        {tab === 'program' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setCalDate(new Date(year, month-1, 1))}>‹</button>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[month]} {year}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setCalDate(new Date(year, month+1, 1))}>›</button>
            </div>
            <div className="cal-grid" style={{ marginBottom: 4 }}>
              {DAYS.map(d => <div key={d} className="cal-header-day">{d}</div>)}
            </div>
            <div className="cal-grid" style={{ marginBottom: 12 }}>
              {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => {
                const ds = dateStr(d)
                const hasDay = getDayData(d)
                const isToday = ds === todayStr
                return (
                  <div key={d}
                    className={`cal-day${hasDay?' cal-day-has':''}${isToday?' cal-day-today':''}`}
                    onClick={() => handleDayClick(d)}>
                    {d}
                    {hasDay && <div className="cal-dot" />}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Нажми на день — открыть или создать тренировку
            </div>
            {monthDays.map((w: any) => (
              <div key={w.id} className="card card-clickable"
                onClick={() => router.push(`/coach/workout/${w.id as string}`)}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
                  {new Date(w.date+'T00:00:00').toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 5 }}>{w.name ?? 'Тренировка'}</div>
                <div>
                  {w.focus_tags?.map((t: string) => (
                    <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DIARY ── */}
        {tab === 'diary' && (
          <div>
            {workoutDays
              .filter(w => new Date(w.date) <= today)
              .reverse()
              .map((w: any) => (
                <div key={w.id} className="card card-clickable"
                  onClick={() => router.push(`/coach/diary/${w.id as string}`)}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
                    {new Date(w.date+'T00:00:00').toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 5 }}>{w.name ?? 'Тренировка'}</div>
                  <div>
                    {w.focus_tags?.map((t: string) => (
                      <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── RECORDS ── */}
        {tab === 'records' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Разовые максимумы</div>
              <button className="btn btn-sm btn-primary"
                onClick={() => router.push(`/coach/athlete/${id}/add-pm`)}>
                + Добавить
              </button>
            </div>
            {pms.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Максимумы не заданы</div>
            ) : pms.map((pm: any) => (
              <div key={pm.id} className="record-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{pm.exercise?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {pm.source === 'passthrough' ? '🔥 проходка' : '✍️ вручную'} · {pm.achieved_at}
                  </div>
                </div>
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--accent2)' }}>
                  {pm.weight_kg} кг
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, background: 'var(--bg3)', padding: '8px 10px', borderRadius: 8 }}>
              Рекорды из проходки обновляются автоматически
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
