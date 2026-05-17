'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Icons ──────────────────────────────────────────────────────────────────
export function IconHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
}
export function IconUsers() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87"/></svg>
}
export function IconTrophy() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9H4a2 2 0 01-2-2V5h4M18 9h2a2 2 0 002-2V5h-4M12 17v4M8 21h8"/><path d="M6 5h12v4a6 6 0 01-12 0V5z"/></svg>
}
export function IconBook() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
}
export function IconUser() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
}
export function IconCalendar() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
export function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14"/></svg>
}
export function IconBack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}
export function IconClose() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12"/></svg>
}
export function IconEdit() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
export function IconTrash() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
}
export function IconChevronRight() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M9 18l6-6-6-6"/></svg>
}
export function IconChevronLeft() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M15 18l-6-6 6-6"/></svg>
}
export function IconTrending() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
}
export function IconSkip() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
}
export function IconFlag() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
}
export function IconPlay() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
}
export function IconLayers() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
}
export function IconDots() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
}
export function IconShield() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}

// ── Avatar ─────────────────────────────────────────────────────────────────
export function Avatar({
  name, size = 'md', green = false
}: {
  name: string; size?: 'sm'|'md'|'lg'; green?: boolean
}) {
  const initials = name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  const sizes = {
    sm: { width: 28, height: 28, fontSize: 10 },
    md: { width: 38, height: 38, fontSize: 13 },
    lg: { width: 52, height: 52, fontSize: 18 },
  }
  return (
    <div className={`avatar${green ? ' avatar-green' : ''}`} style={sizes[size]}>
      {initials}
    </div>
  )
}

// ── Coach Bottom Nav ───────────────────────────────────────────────────────
export function CoachNav() {
  const path = usePathname()
  const items = [
    { href: '/coach', label: 'Главная', icon: <IconHome /> },
    { href: '/coach/records', label: 'Рекорды', icon: <IconTrophy /> },
    { href: '/coach/profile', label: 'Профиль', icon: <IconUser /> },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <Link key={item.href} href={item.href}
          className={`nav-item${path === item.href ? ' active' : ''}`}>
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

// ── Athlete Bottom Nav ─────────────────────────────────────────────────────
export function AthleteNav() {
  const path = usePathname()
  const items = [
    { href: '/athlete', label: 'План', icon: <IconCalendar /> },
    { href: '/athlete/diary', label: 'Дневник', icon: <IconBook /> },
    { href: '/athlete/records', label: 'Рекорды', icon: <IconTrophy /> },
    { href: '/athlete/profile', label: 'Профиль', icon: <IconUser /> },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <Link key={item.href} href={item.href}
          className={`nav-item${path === item.href ? ' active' : ''}`}>
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

// ── Back Button ────────────────────────────────────────────────────────────
export function BackButton({ onClick, label = 'Назад' }: { onClick?: () => void; label?: string }) {
  return (
    <button className="btn btn-ghost btn-sm" onClick={onClick} style={{ gap: 4, padding: '6px 8px' }}>
      <span style={{ width: 18, height: 18, display: 'flex' }}><IconBack /></span>
      {label}
    </button>
  )
}

// ── Section Title ──────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📋', text }: { icon?: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div>{text}</div>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner() {
  return <div className="spinner" />
}

// ── Tag Input ─────────────────────────────────────────────────────────────
// FIX: useState import moved to top of file (was at bottom causing potential hoisting issues)
export function TagInput({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}) {
  const [input, setInput] = useState('')
  const [showSugg, setShowSugg] = useState(false)

  function addTag(tag: string) {
    const t = tag.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
    setShowSugg(false)
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  const filtered = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  )

  return (
    <div>
      <div
        className="tag-input-wrap"
        onClick={() => document.getElementById('tag-inp')?.focus()}
      >
        {tags.map(tag => (
          <span key={tag} className="tag">
            {tag}
            <span
              className="tag-remove"
              onClick={e => { e.stopPropagation(); removeTag(tag) }}>
              ✕
            </span>
          </span>
        ))}
        <input
          id="tag-inp"
          className="tag-input"
          value={input}
          placeholder={tags.length === 0 ? 'Введи тег и нажми Enter' : ''}
          onChange={e => { setInput(e.target.value); setShowSugg(true) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) addTag(input) }
          }}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
        />
      </div>
      {showSugg && filtered.length > 0 && (
        <div className="suggest-list">
          {filtered.slice(0, 5).map(s => (
            <div key={s} className="suggest-item" onMouseDown={() => addTag(s)}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>↩</span> {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
