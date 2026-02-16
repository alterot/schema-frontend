import { useState, useMemo, Fragment } from 'react'

const ROLL_LABELS = {
  lakare: 'Dr.',
  sjukskoterska: 'SSK',
  underskoterska: 'USK',
}

/**
 * Build list of all dates in a YYYY-MM month.
 */
function getDatesInMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const dates = []
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2, '0')}`)
  }
  return dates
}

/**
 * Merge full personnel list (from settings) with schedule data.
 * Returns sorted array of { namn, roll, hasShifts }.
 * People with shifts come first, then absent people.
 */
function getAllPersons(schema, personalList) {
  const namesInSchema = new Set()
  for (const row of schema) {
    for (const name of row.personal || []) namesInSchema.add(name)
  }

  const persons = []
  const seen = new Set()

  // Add everyone from personalList (with role info)
  for (const p of personalList) {
    seen.add(p.namn)
    persons.push({ namn: p.namn, roll: p.roll, hasShifts: namesInSchema.has(p.namn) })
  }

  // Add anyone in schema but not in personalList (safety net)
  for (const name of namesInSchema) {
    if (!seen.has(name)) {
      persons.push({ namn: name, roll: null, hasShifts: true })
    }
  }

  // Sort: people with shifts first, then absent; alphabetical within each group
  persons.sort((a, b) => {
    if (a.hasShifts !== b.hasShifts) return a.hasShifts ? -1 : 1
    return a.namn.localeCompare(b.namn, 'sv')
  })

  return persons
}

/**
 * Build lookup: personName -> { "YYYY-MM-DD": "dag"|"kvall"|"natt" }
 */
function buildPersonShiftMap(schema) {
  const map = {}
  for (const row of schema) {
    const passKey = row.pass === 'kväll' ? 'kvall' : row.pass
    for (const name of row.personal || []) {
      if (!map[name]) map[name] = {}
      map[name][row.datum] = passKey
    }
  }
  return map
}

function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

const SHIFT_LABEL = { dag: 'D', kvall: 'K', natt: 'N' }

/**
 * Build lookup: personName -> Set of "YYYY-MM-DD" dates where person is frånvarande.
 * Uses franvaro_perioder from backend (includes both registered and override absence).
 */
function buildFranvaroSet(franvaroPerioder) {
  const map = {}
  if (!franvaroPerioder) return map
  for (const [namn, perioder] of Object.entries(franvaroPerioder)) {
    const dateSet = new Set()
    for (const p of perioder) {
      const start = new Date(p.start)
      const slut = new Date(p.slut)
      for (let d = new Date(start); d <= slut; d.setDate(d.getDate() + 1)) {
        dateSet.add(d.toISOString().slice(0, 10))
      }
    }
    map[namn] = dateSet
  }
  return map
}

function PersonTimeline({ scheduleData, selectedMonth, personalList = [], onDayClick }) {
  const [expandedPerson, setExpandedPerson] = useState(null)

  const dates = useMemo(() => getDatesInMonth(selectedMonth), [selectedMonth])
  const persons = useMemo(() => getAllPersons(scheduleData.schema || [], personalList), [scheduleData, personalList])
  const shiftMap = useMemo(() => buildPersonShiftMap(scheduleData.schema || []), [scheduleData])
  const franvaroMap = useMemo(() => buildFranvaroSet(scheduleData.franvaro_perioder), [scheduleData])

  // Per-person summary stats
  const personStats = useMemo(() => {
    const stats = {}
    for (const p of persons) {
      const shifts = shiftMap[p.namn] || {}
      const total = Object.keys(shifts).length
      const weekendCount = Object.keys(shifts).filter(d => isWeekend(d)).length
      stats[p.namn] = { total, weekendCount }
    }
    return stats
  }, [persons, shiftMap])

  // Grid columns: sticky person col + date columns
  const gridStyle = {
    gridTemplateColumns: `160px repeat(${dates.length}, 36px)`,
  }

  return (
    <>
      {/* Desktop: full grid */}
      <div className="timeline-wrapper">
        <div className="timeline-grid" style={gridStyle}>
          {/* Header row */}
          <div className="timeline-corner">Personal</div>
          {dates.map(d => {
            const dayNum = parseInt(d.split('-')[2])
            const weekend = isWeekend(d)
            return (
              <div
                key={d}
                className={`timeline-date-header${weekend ? ' weekend' : ''}`}
              >
                {dayNum}
              </div>
            )
          })}

          {/* Person rows */}
          {persons.map(p => (
            <Fragment key={p.namn}>
              <div className={`timeline-person${p.hasShifts ? '' : ' absent'}`}>
                <span className="timeline-person-name">{p.namn.split(' ').pop()}</span>
                {p.roll && <span className="timeline-person-role">{ROLL_LABELS[p.roll] || p.roll}</span>}
                {!p.hasShifts && <span className="timeline-person-badge">Frånv.</span>}
              </div>
              {dates.map(d => {
                const shift = shiftMap[p.namn]?.[d]
                const isFranvarande = franvaroMap[p.namn]?.has(d)
                const cellClass = shift ? shift : (isFranvarande ? 'franvarande' : (p.hasShifts ? 'ledig' : 'franvarande'))
                return (
                  <div
                    key={`${p.namn}-${d}`}
                    className={`timeline-cell ${cellClass}`}
                    onClick={() => onDayClick(d)}
                    title={`${p.namn} - ${d}`}
                  >
                    {shift ? SHIFT_LABEL[shift] : '\u2013'}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Mobile: person cards */}
      <div className="timeline-cards">
        {persons.map(p => {
          const stats = personStats[p.namn]
          const isExpanded = expandedPerson === p.namn

          return (
            <div key={p.namn} className={`timeline-card${p.hasShifts ? '' : ' absent'}`}>
              <div
                className="timeline-card-header"
                onClick={() => setExpandedPerson(isExpanded ? null : p.namn)}
              >
                <div>
                  <div className="timeline-card-name">
                    {p.namn}
                    {!p.hasShifts && <span className="timeline-card-absent-badge">Frånvarande</span>}
                  </div>
                  {p.roll && <div className="timeline-card-role">{ROLL_LABELS[p.roll] || p.roll}</div>}
                </div>
                <div className="timeline-card-summary">
                  <span>{stats.total} pass</span>
                  <span>{stats.weekendCount} helg</span>
                </div>
              </div>

              {isExpanded && (
                <div className="timeline-card-detail">
                  {dates.map(d => {
                    const shift = shiftMap[p.namn]?.[d]
                    const isFranvarande = franvaroMap[p.namn]?.has(d)
                    const cellClass = shift ? shift : (isFranvarande ? 'franvarande' : (p.hasShifts ? 'ledig' : 'franvarande'))
                    const dayNum = parseInt(d.split('-')[2])
                    return (
                      <div
                        key={d}
                        className={`timeline-card-day ${cellClass}`}
                        onClick={() => onDayClick(d)}
                        title={d}
                      >
                        {dayNum}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default PersonTimeline
