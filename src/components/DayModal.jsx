import { useEffect, useRef } from 'react'

const WEEKDAYS = ['Sondag', 'Mandag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lordag']
const WEEKDAYS_SV = ['Sondag', 'Mandag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lordag']

function getSwedishWeekday(dateStr) {
  const days = ['Sondag', 'Mandag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lordag']
  return days[new Date(dateStr).getDay()]
}

function formatSwedishDate(dateStr) {
  const d = new Date(dateStr)
  const months = [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

function getRequiredCount(bemanningsbehov, dateStr, passKey) {
  if (!bemanningsbehov) return null
  const behov = isWeekend(dateStr) ? bemanningsbehov.helg : bemanningsbehov.vardag
  if (!behov || !behov[passKey]) return null
  return Object.values(behov[passKey]).reduce((sum, n) => sum + n, 0)
}

const SHIFT_CONFIG = [
  { key: 'dag', label: 'Dag (07:00-15:00)' },
  { key: 'kvall', label: 'Kvall (15:00-23:00)' },
  { key: 'natt', label: 'Natt (23:00-07:00)' },
]

function DayModal({ datum, dayData, konflikter, bemanningsbehov, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus overlay on mount for accessibility
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.focus()
  }, [])

  const dayConflicts = (konflikter || []).filter(k => k.datum === datum)

  return (
    <div
      className="day-modal-overlay"
      onClick={onClose}
      ref={overlayRef}
      tabIndex={-1}
    >
      <div className="day-modal" onClick={e => e.stopPropagation()}>
        <div className="day-modal-header">
          <h3>{getSwedishWeekday(datum)} {formatSwedishDate(datum)}</h3>
          <button className="day-modal-close" onClick={onClose}>
            Stang
          </button>
        </div>

        <div className="day-modal-body">
          {SHIFT_CONFIG.map(({ key, label }) => {
            const names = dayData?.[key] || []
            const required = getRequiredCount(bemanningsbehov, datum, key)
            const actual = names.length
            const isOk = required === null || actual >= required

            return (
              <div key={key} className="day-modal-shift">
                <div className="day-modal-shift-header">
                  <strong>{label}</strong>
                  <span className={isOk ? 'badge-ok' : 'badge-short'}>
                    {actual}{required !== null ? `/${required}` : ''}
                  </span>
                </div>
                <ul className="day-modal-staff-list">
                  {names.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                  {names.length === 0 && (
                    <li className="empty">Ingen personal tilldelad</li>
                  )}
                </ul>
              </div>
            )
          })}

          {dayConflicts.length > 0 && (
            <div className="day-modal-conflicts">
              <h4>Konflikter</h4>
              <ul>
                {dayConflicts.map((k, i) => (
                  <li key={i} className="day-modal-conflict-item">
                    {k.pass && <strong>{k.pass}: </strong>}
                    {k.beskrivning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DayModal
