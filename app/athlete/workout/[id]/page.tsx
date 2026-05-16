'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { BackButton, IconFlag, IconSkip, IconPlay } from '@/components/ui'

type Screen = 'preview' | 'player' | 'rpe' | 'rest' | 'passthrough-add' | 'complete'
type RpeVal = 'failed' | 'hard' | 'medium' | 'easy'

const RPE_OPTIONS = [
  { value: 'failed' as RpeVal, label: 'Не смог', desc: 'Не удалось выполнить', color: 'var(--red)' },
  { value: 'hard' as RpeVal, label: 'Тяжело', desc: '1–2 повт. в запасе', color: 'var(--amber)' },
  { value: 'medium' as RpeVal, label: 'Средне', desc: '3–5 повт. в запасе', color: 'var(--accent2)' },
  { value: 'easy' as RpeVal, label: 'Легко', desc: '6+ повт. в запасе', color: 'var(--green)' },
]

export default function WorkoutPlayer() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [day, setDay] = useState<any>(null)
  const [screen, setScreen] = useState<Screen>('preview')
  const [athleteId, setAthleteId] = useState('')
  const [sessionId, setSessionId] = useState('')

  // flat list of all (blockExercise, set) pairs
  const [flat, setFlat] = useState<{ be: any; set: any; blockType: string }[]>([])
  const [cursor, setCursor] = useState(0) // index in flat
  const [ptSets, setPtSets] = useState<{ reps: number; weight: number }[]>([])
  const [ptReps, setPtReps] = useState('')
  const [ptWeight, setPtWeight] = useState('')

  const [pendingRpe, setPendingRpe] = useState<RpeVal | null>(null)
  const [restSecs, setRestSecs] = useState(60)
  const [timerLeft, setTimerLeft] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [completedLogs, setCompletedLogs] = useState<string[]>([])
  const [totalSets, setTotalSets] = useState(0)
  const [totalVol, setTotalVol] = useState(0)
  const [motivMsg, setMotivMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setAthleteId(session.user.id)

      const { data: dayData } = await supabase
        .from('workout_days')
        .select(`*, blocks:workout_blocks(*, block_exercises(*, exercise:exercises(name), sets(*)))`)
        .eq('id', id)
        .single()

      if (!dayData) return
      dayData.blocks = (dayData.blocks ?? []).sort((a: any, b: any) => a.position - b.position)
      dayData.blocks.forEach((b: any) => {
        b.block_exercises = (b.block_exercises ?? []).sort((a: any, b: any) => a.position - b.position)
        b.block_exercises.forEach((be: any) => {
          be.sets = (be.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
        })
      })
      setDay(dayData)

      // Build flat list
      const fl: { be: any; set: any; blockType: string }[] = []
      for (const block of dayData.blocks ?? []) {
        for (const be of block.block_exercises ?? []) {
          for (const s of be.sets ?? []) {
            fl.push({ be, set: s, blockType: block.type })
          }
        }
      }
      setFlat(fl)
    }
    init()
  }, [id])

  function startSession() {
    const supabase = createClient()
    supabase.from('workout_sessions')
      .insert({ day_id: id, athlete_id: athleteId })
      .select().single()
      .then(({ data }) => { if (data) setSessionId(data.id) })
    setScreen('player')
  }

  const current = flat[cursor]

  function startTimer(secs: number) {
    setRestSecs(secs)
    setTimerLeft(secs)
    setScreen('rest')
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimerLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setScreen('player')
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (timerRef.current) clearInterval(timerRef.current)
    setScreen('player')
    advanceCursor()
  }

  function advanceCursor() {
    if (cursor + 1 < flat.length) setCursor(c => c + 1)
  }

  async function logSet(setId: string | null, beId: string, reps: number | null, weight: number | null, rpe: RpeVal | null, skipped = false, isPassthrough = false) {
    const supabase = createClient()
    const { data } = await supabase.from('set_logs').insert({
      set_id: setId, be_id: beId, athlete_id: athleteId,
      actual_reps: reps, actual_weight: weight, rpe_value: rpe,
      skipped, is_passthrough: isPassthrough,
    }).select().single()
    if (data) setCompletedLogs(prev => [...prev, data.id])
    if (weight && reps) setTotalVol(v => v + weight * reps)
    setTotalSets(s => s + 1)
  }

  function handleSetDone() {
    const s = current.set
    if (s.rpe_enabled) {
      setPendingRpe(null)
      setScreen('rpe')
    } else {
      logSet(s.id, current.be.id, s.reps, s.weight_kg, null)
      startTimer(s.rest_sec ?? 60)
    }
  }

  function handleRpeSelect(rpe: RpeVal) {
    const s = current.set
    logSet(s.id, current.be.id, s.reps, s.weight_kg, rpe)
    advanceCursor()
    startTimer(s.rest_sec ?? 60)
  }

  function handleSkipSet() {
    const s = current.set
    logSet(s.id, current.be.id, null, null, null, true)
    advanceCursor()
  }

  function handleSkipExercise() {
    const beId = current.be.id
    // skip all remaining sets of this exercise
    let c = cursor
    while (c < flat.length && flat[c].be.id === beId) {
      logSet(flat[c].set.id, beId, null, null, null, true)
      c++
    }
    if (c < flat.length) setCursor(c)
  }

  function handleAddPtSet() {
    const reps = parseInt(ptReps)
    const weight = parseFloat(ptWeight)
    if (!reps || !weight) return
    logSet(null, current.be.id, reps, weight, null, false, true)
    setPtSets(prev => [...prev, { reps, weight }])
    setPtReps('')
    setPtWeight('')
    // show RPE for passthrough
    setScreen('rpe')
  }

  function handlePtRpe(rpe: RpeVal) {
    // Update last log with RPE — for simplicity we just record it
    const supabase = createClient()
    // We re-log: in prod you'd update the last passthrough log
    setScreen('player')
  }

  async function handleFinish() {
    const supabase = createClient()
    if (sessionId) {
      await supabase.from('workout_sessions').update({
        finished_at: new Date().toISOString(),
        total_sets: totalSets,
        total_volume_kg: totalVol,
      }).eq('id', sessionId)
    }
    // Get random motivational message
    const { data: msgs } = await supabase.from('motivational_messages').select('text')
    if (msgs && msgs.length > 0) setMotivMsg(msgs[Math.floor(Math.random() * msgs.length)].text)
    setScreen('complete')
  }

  if (!day) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  // Progress
  const totalFlat = flat.length
  const progress = totalFlat > 0 ? (completedLogs.length / totalFlat) * 100 : 0

  // ── PREVIEW ──────────────────────────────────────
  if (screen === 'preview') {
    return (
      <div className="page">
        <div className="topbar">
          <BackButton onClick={() => router.back()} />
        </div>
        <div className="content" style={{ paddingBottom: 100 }}>
          <h2 style={{ marginBottom: 4 }}>{day.name ?? 'Тренировка'}</h2>
          <div style={{ marginBottom: 16 }}>
            {day.focus_tags?.map((t: string) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}
          </div>

          {day.blocks?.map((block: any) => (
            <div key={block.id} className="ex-block">
              <div className="ex-block-header">
                <div>
                  {block.type === 'superset' && <div className="superset-label" style={{ marginBottom: 4 }}>Суперсет</div>}
                  <div style={{ fontWeight: 600 }}>
                    {block.block_exercises?.map((be: any) => be.exercise?.name).join(' + ')}
                  </div>
                </div>
              </div>
              <div className="ex-block-body">
                {block.block_exercises?.map((be: any) => (
                  <div key={be.id} style={{ marginBottom: 6 }}>
                    {block.type === 'superset' && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 600 }}>{be.exercise?.name}</div>}
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {be.sets?.length} подхода · {be.sets?.[0]?.reps} повт · {be.sets?.[0]?.weight_kg ? `${be.sets[0].weight_kg} кг` : be.sets?.[0]?.weight_pct ? `${be.sets[0].weight_pct}%ПМ` : ''}
                    </div>
                    {be.is_passthrough && <div style={{ marginTop: 4 }}><span className="passthrough-label">⚡ Проходка</span></div>}
                    {be.coach_comment && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>💬 {be.coach_comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="finish-bar">
          <button className="btn btn-primary btn-full btn-large" onClick={startSession}>
            <IconPlay /> Начать тренировку
          </button>
        </div>
      </div>
    )
  }

  // ── COMPLETE ─────────────────────────────────────
  if (screen === 'complete') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
        <h1 style={{ marginBottom: 8 }}>Готово!</h1>
        <div style={{ fontSize: 15, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 28, padding: '0 16px', lineHeight: 1.5 }}>
          "{motivMsg}"
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%', marginBottom: 20 }}>
          <div className="stat-box"><div className="stat-num">{totalSets}</div><div className="stat-label">подходов</div></div>
          <div className="stat-box"><div className="stat-num">{day.blocks?.flatMap((b: any) => b.block_exercises).length}</div><div className="stat-label">упражнений</div></div>
          <div className="stat-box"><div className="stat-num">{(totalVol/1000).toFixed(1)}т</div><div className="stat-label">объём</div></div>
        </div>
        <button className="btn btn-primary btn-full btn-large" onClick={() => router.replace('/athlete')}>
          На главную
        </button>
      </div>
    )
  }

  // ── REST ──────────────────────────────────────────
  if (screen === 'rest') {
    const mins = Math.floor(timerLeft / 60)
    const secs = timerLeft % 60
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <div style={{ width: 60 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Отдых</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
            {current ? `Следующий: ${current.be.exercise?.name}` : ''}
          </div>
          <div className="timer-circle" style={{ width: 140, height: 140, marginBottom: 24 }}>
            <div className="timer-num">{mins}:{String(secs).padStart(2,'0')}</div>
            <div className="timer-label">осталось</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={skipRest}>Пропустить</button>
            <button className="btn btn-primary" onClick={() => setTimerLeft(t => t + 30)}>+30 сек</button>
          </div>
        </div>
        <div className="finish-bar">
          <button className="btn btn-full" style={{ justifyContent: 'center', color: 'var(--text3)' }} onClick={handleFinish}>
            <IconFlag /> Завершить тренировку
          </button>
        </div>
      </div>
    )
  }

  // ── RPE ───────────────────────────────────────────
  if (screen === 'rpe') {
    const isPt = screen === 'rpe' && ptReps === '' && ptSets.length > 0 // rough check
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <div style={{ width: 60 }} />
          <span style={{ fontWeight: 600 }}>Оцени сложность</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginBottom: 6 }}>
            {current?.be.exercise?.name} · Подход {current?.set.set_number}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif" }}>
            {current?.set.reps} × {current?.set.weight_kg} кг
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 24 }}>
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

  // ── PASSTHROUGH ADD ───────────────────────────────
  if (screen === 'passthrough-add') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <BackButton onClick={() => setScreen('player')} />
          <span style={{ fontWeight: 600 }}>Рабочий подход</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>
            {current?.be.exercise?.name} · Проходка
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginBottom: 4 }}>
            {current?.be.pt_instruction}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 20 }}>
            Предыдущих рабочих подходов: {ptSets.length}
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div>
              <label className="label" style={{ textAlign: 'center', display: 'block' }}>Повторений</label>
              <input className="input" type="number" placeholder="3"
                value={ptReps} onChange={e => setPtReps(e.target.value)}
                style={{ textAlign: 'center', fontSize: 24, height: 56 }} />
            </div>
            <div>
              <label className="label" style={{ textAlign: 'center', display: 'block' }}>Вес (кг)</label>
              <input className="input" type="number" placeholder="120"
                value={ptWeight} onChange={e => setPtWeight(e.target.value)}
                style={{ textAlign: 'center', fontSize: 24, height: 56 }} />
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 10 }}>Оцени сложность</div>
          <div className="rpe-grid">
            {RPE_OPTIONS.map(opt => (
              <div key={opt.value} className="rpe-btn" onClick={() => {
                const r = parseInt(ptReps), w = parseFloat(ptWeight)
                if (!r || !w) return
                logSet(null, current.be.id, r, w, opt.value, false, true)
                setPtSets(prev => [...prev, { reps: r, weight: w }])
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

  // ── PLAYER ───────────────────────────────────────
  if (!current) {
    // All sets done
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 16 }}>Все упражнения выполнены!</h2>
        <button className="btn btn-primary btn-large" onClick={handleFinish}>
          <IconFlag /> Завершить тренировку
        </button>
      </div>
    )
  }

  const { be, set, blockType } = current
  // Group: find all sets for this be
  const beSets = flat.filter(f => f.be.id === be.id)
  const beStart = flat.findIndex(f => f.be.id === be.id)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>✕ Выйти</button>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          {cursor + 1} / {totalFlat} подходов
        </span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {blockType === 'superset' && <span className="superset-label">Суперсет</span>}
          <h2>{be.exercise?.name}</h2>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
          {beSets.length} подходов
          {be.is_passthrough && <span className="passthrough-label" style={{ marginLeft: 8 }}>⚡ Проходка</span>}
        </div>

        {be.coach_comment && (
          <div className="info-box" style={{ marginBottom: 12 }}>💬 {be.coach_comment}</div>
        )}

        {/* Sets list */}
        {beSets.map((item, idx) => {
          const globalIdx = beStart + idx
          const isDone = globalIdx < cursor
          const isCurrent = globalIdx === cursor
          return (
            <div key={item.set.id} className={`set-row${isCurrent ? ' set-row-active' : ''}`} style={!isDone && !isCurrent ? { opacity: .45 } : {}}>
              <div className={`set-num${isDone ? ' set-num-done' : isCurrent ? ' set-num-active' : ''}`}>
                {item.set.set_number}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: isDone || isCurrent ? 600 : 400 }}>
                {item.set.reps} × {item.set.weight_kg ? `${item.set.weight_kg} кг` : item.set.weight_pct ? `${item.set.weight_pct}%ПМ` : '?'}
                {item.set.rpe_enabled && ' · RPE'}
              </div>
              {isDone && <span className="badge badge-green">✓</span>}
              {isCurrent && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-ghost" onClick={handleSkipSet}>Пропустить</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSetDone}>Выполнен</button>
                </div>
              )}
            </div>
          )
        })}

        {/* Passthrough section */}
        {be.is_passthrough && (
          <>
            <div className="divider" />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Рабочие подходы — проходка</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              {be.pt_instruction ?? 'Добавляй подходы до предела'}
            </div>
            {ptSets.map((s, i) => (
              <div key={i} className="set-row">
                <div className="set-num set-num-done">Р{i+1}</div>
                <div style={{ fontSize: 13 }}>{s.reps} × {s.weight} кг</div>
                <span className="badge badge-green">✓</span>
              </div>
            ))}
            <button className="btn btn-full" style={{ justifyContent: 'center', marginTop: 8, borderColor: 'var(--accentbdr)', color: 'var(--accent2)' }}
              onClick={() => setScreen('passthrough-add')}>
              + Добавить рабочий подход
            </button>
          </>
        )}

        {/* Skip exercise */}
        <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop: 12, color: 'var(--text3)' }}
          onClick={handleSkipExercise}>
          <IconSkip /> Пропустить упражнение
        </button>
      </div>

      <div className="finish-bar">
        <button className="btn btn-primary btn-full" style={{ justifyContent: 'center' }} onClick={handleFinish}>
          <IconFlag /> Завершить тренировку
        </button>
      </div>
    </div>
  )
}
