import { useState, useMemo, Fragment } from 'react'

const ROLL_LABELS = {
  lakare: 'Lak',
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
 * Get all unique person names from schedule data, sorted by role then name.
 */
function getPersonList(schema) {
  // Build map: name -> { shifts by date }
  const personMap = {}
  for (const row of schema) {
    for (const name of row.personal || []) {
      if (!personMap[name]) personMap[name] = { name }
      // We don't have role info in schema rows, but we can infer from name patterns
    }
  }
  return Object.keys(personMap).sort()
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

function PersonTimeline({ scheduleData, selectedMonth, onDayClick }) {
  const [expandedPerson, setExpandedPerson] = useState(null)

  const dates = useMemo(() => getDatesInMonth(selectedMonth), [selectedMonth])
  const persons = useMemo(() => getPersonList(scheduleData.schema || []), [scheduleData])
  const shiftMap = useMemo(() => buildPersonShiftMap(scheduleData.schema || []), [scheduleData])

  // Per-person summary stats
  const personStats = useMemo(() => {
    const stats = {}
    for (const name of persons) {
      const shifts = shiftMap[name] || {}
      const total = Object.keys(shifts).length
      const weekendCount = Object.keys(shifts).filter(d => isWeekend(d)).length
      stats[name] = { total, weekendCount }
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
          {persons.map(name => (
            <Fragment key={name}>
              <div className="timeline-person">
                <span className="timeline-person-name">{name.split(' ').pop()}</span>
              </div>
              {dates.map(d => {
                const shift = shiftMap[name]?.[d]
                const cellClass = shift || 'ledig'
                return (
                  <div
                    key={`${name}-${d}`}
                    className={`timeline-cell ${cellClass}`}
                    onClick={() => onDayClick(d)}
                    title={`${name} - ${d}`}
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
        {persons.map(name => {
          const stats = personStats[name]
          const isExpanded = expandedPerson === name

          return (
            <div key={name} className="timeline-card">
              <div
                className="timeline-card-header"
                onClick={() => setExpandedPerson(isExpanded ? null : name)}
              >
                <div>
                  <div className="timeline-card-name">{name}</div>
                </div>
                <div className="timeline-card-summary">
                  <span>{stats.total} pass</span>
                  <span>{stats.weekendCount} helg</span>
                </div>
              </div>

              {isExpanded && (
                <div className="timeline-card-detail">
                  {dates.map(d => {
                    const shift = shiftMap[name]?.[d]
                    const cellClass = shift || 'ledig'
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
