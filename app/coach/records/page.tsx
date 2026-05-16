'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CoachNav, Avatar, Spinner } from '@/components/ui'

export default function CoachRecords() {
  const router = useRouter()
  const [athletes, setAthletes] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [pms, setPms] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: athl } = await supabase.from('profiles').select('*').eq('coach_id', session.user.id)
      setAthletes(athl ?? [])
      if (athl && athl.length > 0) {
        setSelectedId(athl[0].id)
        loadPms(athl[0].id, athl.map((a: any) => a.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function loadPms(athleteId: string, allIds: string[]) {
    const supabase = createClient()
    const [{ data: pmData }, { data: feedData }] = await Promise.all([
      supabase.from('personal_maxes').select('*, exercise:exercises(name)').eq('athlete_id', athleteId).order('weight_kg', { ascending: false }),
      supabase.from('personal_maxes').select('*, exercise:exercises(name), athlete:profiles!athlete_id(name)').in('athlete_id', allIds).order('achieved_at', { ascending: false }).limit(20),
    ])
    setPms(pmData ?? [])
    setFeed(feedData ?? [])
  }

  if (loading) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="topbar"><h1>Рекорды</h1></div>
      <div className="content">
        {/* Athlete selector */}
        {athletes.length > 0 && (
          <div className="sel" style={{ marginBottom: 14 }}>
            {athletes.map(a => (
              <div key={a.id} className={`tab${selectedId === a.id ? ' active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => { setSelectedId(a.id); loadPms(a.id, athletes.map(x => x.id)) }}>
                {a.name.split(' ')[0]}
              </div>
            ))}
          </div>
        )}

        {/* Selected athlete PMs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Максимумы — {athletes.find(a => a.id === selectedId)?.name}</div>
          <button className="btn btn-sm btn-primary"
            onClick={() => router.push(`/coach/athlete/${selectedId}/add-pm`)}>
            + Добавить
          </button>
        </div>

        {pms.map(pm => (
          <div key={pm.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{pm.exercise?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {pm.source === 'passthrough' ? '🔥 проходка' : '✍️ вручную'} · {pm.achieved_at}
              </div>
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--accent2)' }}>
              {pm.weight_kg} кг
            </span>
          </div>
        ))}

        <div className="divider" />
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Лента — все подопечные</div>
        {feed.map(pm => (
          <div key={pm.id + pm.athlete_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <Avatar name={pm.athlete?.name ?? '?'} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{pm.athlete?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {pm.exercise?.name} <strong style={{ color: 'var(--accent2)' }}>{pm.weight_kg}×1</strong>
              </div>
            </div>
            <span className="badge badge-accent">Рекорд</span>
          </div>
        ))}
      </div>
      <CoachNav />
    </div>
  )
}
