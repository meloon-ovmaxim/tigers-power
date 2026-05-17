'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Screen = 'preview' | 'player' | 'rpe' | 'rest' | 'pt-add' | 'complete' | 'finish-confirm'
type RpeVal = 'failed' | 'hard' | 'medium' | 'easy'

const RPE_OPTIONS = [
  { value: 'failed' as RpeVal, label: 'Не смог', desc: 'Не удалось выполнить', color: '#EF4444' },
  { value: 'hard' as RpeVal, label: 'Тяжело', desc: '1–2 повт. в запасе', color: '#F59E0B' },
  { value: 'medium' as RpeVal, label: 'Средне', desc: '3–5 повт. в запасе', color: '#4D78FF' },
  { value: 'easy' as RpeVal, label: 'Легко', desc: '6+ повт. в запасе', color: '#22C55E' },
]

const RPE_LABELS: Record<RpeVal, string> = {
  failed: 'Не смог',
  hard: 'Тяжело',
  medium: 'Средне',
  easy: 'Легко',
}

const RPE_COLORS: Record<RpeVal, string> = {
  failed: '#EF4444',
  hard: '#F59E0B',
  medium: '#4D78FF',
  easy: '#22C55E',
}

interface FlatItem { be: any; set: any; blockType: string }
interface PtSet { reps: number; weight: number; rpe: RpeVal }

export default function WorkoutPlayer() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [day, setDay] = useState<any>(null)
  const [screen, setScreen] = useState<Screen>('preview')
  const [athleteId, setAthleteId] = useState('')
  const [sessionId, setSessionId] = useState('')

  const [flat, setFlat] = useState<FlatItem[]>([])
  const [cursor, setCursor] = useState(0)
  const setStatusRef = useRef<Record<number, 'done' | 'skipped'>>({})
  const [setStatus, setSetStatusState] = useState<Record<number, 'done' | 'skipped'>>({})
  const [rpeForIndex, setRpeForIndex] = useState(-1)

  // Passthrough
  const [ptSets, setPtSets] = useState<PtSet[]>([])
  const [ptEditIdx, setPtEditIdx] = useState<number | null>(null)
  const [ptReps, setPtReps] = useState('')
  const [ptWeight, setPtWeight] = useState('')
  const [ptCurrentBeId, setPtCurrentBeId] = useState('')

  // Timer
  const [timerLeft, setTimerLeft] = useState(60)
  const [timerTotal, setTimerTotal] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stats
  const [totalSets, setTotalSets] = useState(0)
  const [totalVol, setTotalVol] = useState(0)
  const [motivMsg, setMotivMsg] = useState('')

  // Session persist - save progress to localStorage
  const SESSION_KEY = `tp_session_${id}`

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setAthleteId(session.user.id)

      const { data: dayData } = await supabase
        .from('workout_days')
        .select(`*, blocks:workout_blocks(*, block_exercises(*, exercise:exercises(name, video_url), sets(*)))`)
        .eq('id', id).single()
      if (!dayData) return

      dayData.blocks = (dayData.blocks ?? []).sort((a: any, b: any) => a.position - b.position)
      dayData.blocks.forEach((b: any) => {
        b.block_exercises = (b.block_exercises ?? []).sort((a: any, b: any) => a.position - b.position)
        b.block_exercises.forEach((be: any) => {
          be.sets = (be.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
        })
      })
      setDay(dayData)

      const fl: FlatItem[] = []
      for (const block of dayData.blocks ?? []) {
        for (const be of block.block_exercises ?? []) {
          for (const s of be.sets ?? []) {
            fl.push({ be, set: s, blockType: block.type })
          }
        }
      }
      setFlat(fl)

      // Restore saved session
      try {
        const saved = localStorage.getItem(SESSION_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setStatusRef.current = parsed.setStatus ?? {}
          setSetStatusState(parsed.setStatus ?? {})
          setCursor(parsed.cursor ?? 0)
          setSessionId(parsed.sessionId ?? '')
          setTotalSets(parsed.totalSets ?? 0)
          setTotalVol(parsed.totalVol ?? 0)
          setPtSets(parsed.ptSets ?? [])
          if (parsed.sessionId) setScreen('player')
        }
      } catch {}
    }
    init()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [id])

  function saveSession(extra: Record<string, any> = {}) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        setStatus: setStatusRef.current,
        cursor,
        sessionId,
        totalSets,
        totalVol,
        ptSets,
        ...extra,
      }))
    } catch {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }

  function updateStatus(updates: Record<number, 'done' | 'skipped'>) {
    const next = { ...setStatusRef.current, ...updates }
    setStatusRef.current = next
    setSetStatusState({ ...next })
  }

  function findNextCursor(from: number): number {
    let next = from + 1
    while (next < flat.length && setStatusRef.current[next]) next++
    return next
  }

  async function logSet(
    setId: string | null, beId: string,
    reps: number | null, weight: number | null,
    rpe: RpeVal | null, skipped = false, isPt = false
  ) {
    const supabase = createClient()
    await supabase.from('set_logs').insert({
      set_id: setId, be_id: beId, athlete_id: athleteId,
      actual_reps: reps, actual_weight: weight, rpe_value: rpe,
      skipped, is_passthrough: isPt,
    })
    if (!skipped && weight && reps) {
      setTotalVol(v => v + weight * reps)
      setTotalSets(s => s + 1)
    }
  }

  function startTimer(secs: number) {
    const s = Math.max(secs, 1)
    setTimerLeft(s); setTimerTotal(s); setScreen('rest')
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimerLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); setScreen('player'); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function handleSetDone() {
    const idx = cursor
    const { set, be } = flat[idx]
    updateStatus({ [idx]: 'done' })
    if (set.rpe_enabled) {
      setRpeForIndex(idx)
      setScreen('rpe')
    } else {
      logSet(set.id, be.id, set.reps, set.weight_kg, null)
      const next = findNextCursor(idx)
      setCursor(next)
      saveSession({ cursor: next })
      startTimer(set.rest_sec ?? 60)
    }
  }

  function handleRpeSelect(rpe: RpeVal) {
    const idx = rpeForIndex >= 0 ? rpeForIndex : cursor
    const { set, be } = flat[idx]
    logSet(set.id, be.id, set.reps, set.weight_kg, rpe)
    const next = findNextCursor(idx)
    setCursor(next)
    saveSession({ cursor: next })
    startTimer(set.rest_sec ?? 60)
    setRpeForIndex(-1)
  }

  function handleSkipSet() {
    const idx = cursor
    const { set, be } = flat[idx]
    updateStatus({ [idx]: 'skipped' })
    logSet(set.id, be.id, null, null, null, true)
    const next = findNextCursor(idx)
    setCursor(next)
    saveSession({ cursor: next })
    setScreen('player')
  }

  function handleSkipExercise() {
    const beId = flat[cursor]?.be.id
    if (!beId) return
    let c = cursor
    const updates: Record<number, 'done' | 'skipped'> = {}
    while (c < flat.length && flat[c].be.id === beId) {
      if (!setStatusRef.current[c]) {
        updates[c] = 'skipped'
        logSet(flat[c].set.id, beId, null, null, null, true)
      }
      c++
    }
    updateStatus(updates)
    // Check if workout is done
    if (c >= flat.length) {
      setScreen('finish-confirm')
    } else {
      setCursor(c)
      saveSession({ cursor: c })
      setScreen('player')
    }
  }

  // FIX 4: Finish passthrough exercise and go to next
  function handleFinishPassthrough() {
    const beId = flat[cursor]?.be.id
    if (!beId) return
    // Mark all remaining sets of this be as done
    let c = cursor
    const updates: Record<number, 'done' | 'skipped'> = {}
    while (c < flat.length && flat[c].be.id === beId) {
      if (!setStatusRef.current[c]) updates[c] = 'done'
      c++
    }
    updateStatus(updates)
    if (c >= flat.length) {
      setScreen('finish-confirm')
    } else {
      setCursor(c)
      saveSession({ cursor: c })
      setScreen('player')
    }
  }

  function skipRest() {
    if (timerRef.current) clearInterval(timerRef.current)
    setScreen('player')
  }

  async function startSession() {
    const supabase = createClient()
    const { data } = await supabase
      .from('workout_sessions')
      .insert({ day_id: id, athlete_id: athleteId })
      .select().single()
    const sid = data?.id ?? ''
    setSessionId(sid)
    saveSession({ sessionId: sid })
    setScreen('player')
  }

  async function handleFinish() {
    if (timerRef.current) clearInterval(timerRef.current)
    const supabase = createClient()
    if (sessionId) {
      await supabase.from('workout_sessions').update({
        finished_at: new Date().toISOString(),
        total_sets: totalSets,
        total_volume_kg: totalVol,
      }).eq('id', sessionId)
    }
    const { data: msgs } = await supabase.from('motivational_messages').select('text')
    if (msgs?.length) setMotivMsg(msgs[Math.floor(Math.random() * msgs.length)].text)
    clearSession()
    setScreen('complete')
  }

  // FIX 6: Go back without losing progress
  function handleBack() {
    saveSession()
    router.back()
  }

  if (!day) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  const doneCount = Object.keys(setStatus).length
  const progress = flat.length > 0 ? (doneCount / flat.length) * 100 : 0
  const current = cursor < flat.length ? flat[cursor] : null
  const hasActiveSession = !!sessionId

  // ── PREVIEW ──────────────────────────────────────────────────────────────
  if (screen === 'preview') return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Назад</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        <h2 style={{ marginBottom: 4 }}>{day.name ?? 'Тренировка'}</h2>
        <div style={{ marginBottom: 16 }}>
          {day.focus_tags?.map((t: string) => (
            <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>
          ))}
        </div>
        {day.blocks?.map((block: any) => (
          <div key={block.id} className="ex-block">
            <div className="ex-block-header">
              <div>
                {block.type === 'superset' && <div className="superset-label" style={{ marginBottom: 4 }}>Суперсет</div>}
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {block.block_exercises?.map((be: any) => be.exercise?.name).join(' + ')}
                </div>
              </div>
            </div>
            <div className="ex-block-body">
              {block.block_exercises?.map((be: any) => (
                <div key={be.id} style={{ marginBottom: 6 }}>
                  {block.type === 'superset' && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 3 }}>{be.exercise?.name}</div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {be.sets?.length} подх{be.sets?.[0]?.reps ? ` × ${be.sets[0].reps} повт` : ''}
                    {be.sets?.[0]?.weight_kg ? ` · ${be.sets[0].weight_kg} кг` : ''}
                  </div>
                  {be.is_passthrough && <div style={{ marginTop: 3 }}><span className="passthrough-label">⚡ Проходка</span></div>}
                  {be.video_url && (
                    <a href={be.video_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: 'var(--accent2)', padding: '3px 8px', background: 'var(--accentbg)', border: '1px solid var(--accentbdr)', borderRadius: 6, textDecoration: 'none' }}>
                      ▶ Видео
                    </a>
                  )}
                  {be.coach_comment && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>💬 {be.coach_comment}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* FIX 8: button right after last exercise, no large size */}
      <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        {hasActiveSession ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-full" style={{ justifyContent: 'center' }}
              onClick={() => setScreen('player')}>
              Продолжить тренировку
            </button>
            <button className="btn btn-danger" style={{ justifyContent: 'center', whiteSpace: 'nowrap' }}
              onClick={handleFinish}>
              Завершить
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-full" style={{ justifyContent: 'center' }}
            onClick={startSession}>
            Начать тренировку
          </button>
        )}
      </div>
    </div>
  )

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (screen === 'complete') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
      <h1 style={{ marginBottom: 8 }}>Готово!</h1>
      <div style={{ fontSize: 14, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 28, lineHeight: 1.6 }}>
        "{motivMsg}"
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%', marginBottom: 20 }}>
        <div className="stat-box"><div className="stat-num">{totalSets}</div><div className="stat-label">подходов</div></div>
        <div className="stat-box"><div className="stat-num">{day.blocks?.flatMap((b: any) => b.block_exercises).length}</div><div className="stat-label">упражнений</div></div>
        <div className="stat-box"><div className="stat-num">{(totalVol / 1000).toFixed(1)}т</div><div className="stat-label">объём</div></div>
      </div>
      <button className="btn btn-primary btn-full" onClick={() => router.replace('/athlete')}>
        На главную
      </button>
    </div>
  )

  // FIX 5: Finish confirm popup
  if (screen === 'finish-confirm') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🏁</div>
      <h2 style={{ marginBottom: 8 }}>Закончили тренировку?</h2>
      <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28 }}>
        Больше упражнений нет.
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button className="btn btn-full" style={{ justifyContent: 'center' }}
          onClick={() => setScreen('player')}>
          Нет, вернуться
        </button>
        <button className="btn btn-primary btn-full" style={{ justifyContent: 'center' }}
          onClick={handleFinish}>
          Да, завершить
        </button>
      </div>
    </div>
  )

  // ── REST — FIX 1: everything fits on one screen, no scroll ────────────────
  if (screen === 'rest') {
    const mins = Math.floor(timerLeft / 60)
    const secs = timerLeft % 60
    const pct = timerTotal > 0 ? ((timerTotal - timerLeft) / timerTotal) * 100 : 0
    const circleLen = 2 * Math.PI * 56

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: 'var(--bg)', overflow: 'hidden',
      }}>
        {/* Compact topbar */}
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Отдых</span>
        </div>

        {/* All content in flex center, no scroll */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '16px 24px' }}>
          {current && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Следующее</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{current.be.exercise?.name}</div>
              {current.set.weight_kg && (
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{current.set.reps} × {current.set.weight_kg} кг</div>
              )}
            </div>
          )}

          {/* Circular timer */}
          <div style={{ position: 'relative', width: 130, height: 130 }}>
            <svg width="130" height="130" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r="56" fill="none" stroke="var(--border2)" strokeWidth="4" />
              <circle cx="65" cy="65" r="56" fill="none" stroke="var(--accent)" strokeWidth="4"
                strokeDasharray={String(circleLen)}
                strokeDashoffset={String(circleLen * (1 - pct / 100))}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 34, fontWeight: 800, color: 'var(--accent2)' }}>
                {mins}:{String(secs).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 9, color: 'var(--accent3)', textTransform: 'uppercase', letterSpacing: .6 }}>осталось</div>
            </div>
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button className="btn btn-full" style={{ justifyContent: 'center' }} onClick={skipRest}>
              Пропустить
            </button>
            <button className="btn btn-outline btn-full" style={{ justifyContent: 'center' }}
              onClick={() => setTimerLeft(t => t + 30)}>
              +30 сек
            </button>
          </div>

          {/* Finish */}
          <button className="btn btn-ghost" style={{ color: 'var(--text3)', fontSize: 12 }} onClick={handleFinish}>
            Завершить тренировку
          </button>
        </div>
      </div>
    )
  }

  // ── RPE ───────────────────────────────────────────────────────────────────
  if (screen === 'rpe') {
    const idx = rpeForIndex >= 0 ? rpeForIndex : cursor
    const item = flat[idx]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600 }}>Оцени сложность</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginBottom: 4 }}>
            {item?.be?.exercise?.name} · Подход {item?.set?.set_number}
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
            {item?.set?.reps ? `${item.set.reps} повт` : ''}
            {item?.set?.weight_kg ? ` · ${item.set.weight_kg} кг` : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 24 }}>
            После оценки запустится таймер отдыха
          </div>
          <div className="rpe-grid">
            {RPE_OPTIONS.map(opt => (
              <div key={opt.value} className="rpe-btn" onClick={() => handleRpeSelect(opt.value)}>
                <div className="rpe-title" style={{ color: opt.color }}>{opt.label}</div>
                <div className="rpe-desc">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── PASSTHROUGH ADD / EDIT ─────────────────────────────────────────────────
  if (screen === 'pt-add') {
    const ptBe = flat.find(f => f.be.id === ptCurrentBeId)?.be ?? current?.be
    const isEditing = ptEditIdx !== null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setScreen('player'); setPtEditIdx(null) }}>← Назад</button>
          <span style={{ fontWeight: 600 }}>{isEditing ? 'Редактировать подход' : 'Рабочий подход'}</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
            {ptBe?.exercise?.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginBottom: 4 }}>
            {ptBe?.pt_instruction}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 20 }}>
            Рабочих подходов: {ptSets.length}
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div>
              <label className="label" style={{ textAlign: 'center', display: 'block' }}>Повторений</label>
              <input className="input" type="number" placeholder="3" value={ptReps}
                onChange={e => setPtReps(e.target.value)}
                style={{ textAlign: 'center', fontSize: 22, height: 54 }} />
            </div>
            <div>
              <label className="label" style={{ textAlign: 'center', display: 'block' }}>Вес (кг)</label>
              <input className="input" type="number" placeholder="120" value={ptWeight}
                onChange={e => setPtWeight(e.target.value)}
                style={{ textAlign: 'center', fontSize: 22, height: 54 }} />
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 10 }}>
            {isEditing ? 'Обнови оценку' : 'Оцени сложность'}
          </div>
          <div className="rpe-grid">
            {RPE_OPTIONS.map(opt => (
              <div key={opt.value} className="rpe-btn" onClick={() => {
                const r = parseInt(ptReps), w = parseFloat(ptWeight)
                if (!r || !w) { alert('Введи повторения и вес'); return }
                if (!ptBe) return
                if (isEditing && ptEditIdx !== null) {
                  // FIX 3: Edit existing pt set
                  setPtSets(prev => prev.map((s, i) => i === ptEditIdx
                    ? { reps: r, weight: w, rpe: opt.value }
                    : s
                  ))
                  setPtEditIdx(null)
                } else {
                  logSet(null, ptBe.id, r, w, opt.value, false, true)
                  setPtSets(prev => {
                    const next = [...prev, { reps: r, weight: w, rpe: opt.value }]
                    saveSession({ ptSets: next })
                    return next
                  })
                }
                setPtReps(''); setPtWeight('')
                setScreen('player')
              }}>
                <div className="rpe-title" style={{ color: opt.color }}>{opt.label}</div>
                <div className="rpe-desc">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── ALL DONE ───────────────────────────────────────────────────────────────
  if (!current) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
      <h2 style={{ marginBottom: 16 }}>Все подходы выполнены!</h2>
      <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={handleFinish}>
        Завершить тренировку
      </button>
    </div>
  )

  // ── PLAYER ────────────────────────────────────────────────────────────────
  const { be, set, blockType } = current
  const beSets = flat.filter(f => f.be.id === be.id)
  const beStart = flat.findIndex(f => f.be.id === be.id)
  const ptForCurrentBe = ptSets // ptSets are per-exercise since we reset on navigate

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="topbar">
        {/* FIX 6: back button saves progress */}
        <button className="btn btn-ghost btn-sm" onClick={handleBack}>← Назад</button>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>{doneCount}/{flat.length} подходов</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {blockType === 'superset' && <span className="superset-label">Суперсет</span>}
          <h2>{be.exercise?.name}</h2>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
          {beSets.length} подходов
          {be.is_passthrough && <span className="passthrough-label" style={{ marginLeft: 8 }}>⚡ Проходка</span>}
        </div>

        {/* FIX 2: bigger video button with icon */}
        {be.video_url && (
          <a href={be.video_url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
              fontSize: 13, fontWeight: 600, color: 'var(--accent2)',
              padding: '8px 14px', background: 'var(--accentbg)',
              border: '1px solid var(--accentbdr)', borderRadius: 10,
              textDecoration: 'none',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Видео-инструкция
          </a>
        )}

        {be.coach_comment && (
          <div className="info-box" style={{ marginBottom: 10 }}>💬 {be.coach_comment}</div>
        )}

        {/* Sets */}
        {beSets.map((item, idx) => {
          const gi = beStart + idx
          const status = setStatus[gi]
          const isDone = status === 'done'
          const isSkipped = status === 'skipped'
          const isCurrent = gi === cursor && !status

          return (
            <div key={item.set.id}
              className={`set-row${isCurrent ? ' set-row-active' : ''}`}
              style={{ opacity: (!isDone && !isSkipped && !isCurrent) ? .35 : 1 }}>
              <div className={`set-num${isDone ? ' set-num-done' : isCurrent ? ' set-num-active' : ''}`}>
                {isDone ? '✓' : isSkipped ? '—' : item.set.set_number}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: isCurrent || isDone ? 600 : 400 }}>
                {item.set.is_warmup && <span style={{ fontSize: 9, color: 'var(--text3)', marginRight: 5, textTransform: 'uppercase' }}>разм</span>}
                {item.set.reps ? `${item.set.reps} повт` : ''}
                {item.set.weight_kg ? ` · ${item.set.weight_kg} кг` : item.set.weight_pct ? ` · ${item.set.weight_pct}%ПМ` : ''}
                {item.set.rpe_enabled ? ' · RPE' : ''}
              </div>
              {isDone && <span className="badge badge-green">Готово</span>}
              {isSkipped && <span className="badge badge-gray">Пропущен</span>}
              {isCurrent && (
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} onClick={handleSkipSet}>Пропустить</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSetDone}>Выполнен ✓</button>
                </div>
              )}
            </div>
          )
        })}

        {/* Passthrough section */}
        {be.is_passthrough && (
          <>
            <div className="divider" />
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Рабочие подходы — проходка</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              {be.pt_instruction ?? 'Добавляй подходы до предела'}
            </div>

            {/* FIX 3: show pt sets with RPE tag + edit button */}
            {ptSets.map((s, i) => (
              <div key={i} className="set-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                <div className="set-num set-num-done">Р{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{s.reps} × {s.weight} кг</div>
                {/* FIX 3: RPE tag */}
                <span style={{
                  padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: `${RPE_COLORS[s.rpe]}22`,
                  color: RPE_COLORS[s.rpe],
                  border: `1px solid ${RPE_COLORS[s.rpe]}44`,
                }}>
                  {RPE_LABELS[s.rpe]}
                </span>
                {/* FIX 3: edit button */}
                <button className="btn btn-sm btn-ghost" style={{ fontSize: 10, padding: '3px 7px' }}
                  onClick={() => {
                    setPtEditIdx(i)
                    setPtReps(String(s.reps))
                    setPtWeight(String(s.weight))
                    setPtCurrentBeId(be.id)
                    setScreen('pt-add')
                  }}>
                  ✎
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-outline btn-full" style={{ justifyContent: 'center' }}
                onClick={() => {
                  setPtReps(''); setPtWeight('')
                  setPtCurrentBeId(be.id)
                  setPtEditIdx(null)
                  setScreen('pt-add')
                }}>
                + Добавить рабочий подход
              </button>
            </div>

            {/* FIX 4: Finish passthrough button */}
            <button
              className="btn btn-primary btn-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              onClick={handleFinishPassthrough}>
              Завершить упражнение →
            </button>
          </>
        )}

        {/* Skip exercise */}
        <button className="btn btn-ghost btn-full btn-sm"
          style={{ marginTop: 10, color: 'var(--text3)', justifyContent: 'center' }}
          onClick={handleSkipExercise}>
          ⏭ Пропустить упражнение
        </button>
      </div>

      {/* FIX 8: compact finish bar */}
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        <button className="btn btn-primary btn-full" style={{ justifyContent: 'center' }} onClick={handleFinish}>
          Завершить тренировку
        </button>
      </div>
    </div>
  )
}
