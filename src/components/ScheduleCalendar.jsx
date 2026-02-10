import { useState, useEffect, useMemo } from 'react'
import { loadRequirements } from '../utils/storage'
import { API_ENDPOINTS } from '../config'
import DayModal from './DayModal'
import PersonTimeline from './PersonTimeline'
import './ScheduleCalendar.css'

const WEEKDAY_HEADERS = ['Man', 'Tis', 'Ons', 'Tor', 'Fre', 'Lor', 'Son']

// --- Pure helper functions ---

/**
 * Build a 2D array of week rows for a calendar grid.
 * Week starts on Monday (Swedish standard).
 * Returns array of 4-6 week rows, each with 7 entries (date string or null).
 */
function buildCalendarGrid(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  // getDay(): 0=Sun, 1=Mon ... 6=Sat -> convert to Mon=0, Tue=1 ... Sun=6
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7

  const weeks = []
  let currentWeek = new Array(firstDow).fill(null)

  for (let day = 1; day <= lastDay; day++) {
    currentWeek.push(`${yearMonth}-${String(day).padStart(2, '0')}`)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  return weeks
}

/**
 * Group flat schema rows into day-based structure.
 * Input:  [{datum, pass, personal: [names]}, ...]
 * Output: [{datum, dag: [names], kvall: [names], natt: [names]}, ...]
 */
function groupScheduleByDay(schemaRows) {
  if (!schemaRows || schemaRows.length === 0) return []

  const dayMap = {}
  for (const row of schemaRows) {
    const datum = row.datum
    if (!dayMap[datum]) {
      dayMap[datum] = { datum, dag: [], kvall: [], natt: [] }
    }
    const passType = row.pass === 'kväll' ? 'kvall' : row.pass
    if (dayMap[datum][passType] !== undefined) {
      dayMap[datum][passType] = row.personal || []
    }
  }

  return Object.values(dayMap).sort((a, b) => a.datum.localeCompare(b.datum))
}

function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

/**
 * Determine day status from konflikter array.
 */
function getDayStatus(datum, dayData, konflikter) {
  const dayConflicts = konflikter.filter(k => k.datum === datum)

  if (dayConflicts.length > 0) {
    const hasSevere = dayConflicts.some(
      k => k.allvarlighetsgrad === 3 || k.typ === 'undermanning'
    )
    return hasSevere ? 'error' : 'warning'
  }

  if (!dayData) return 'error'
  if (dayData.dag.length === 0 && dayData.kvall.length === 0 && dayData.natt.length === 0) {
    return 'error'
  }

  return 'ok'
}

/**
 * Get shift summary (actual/required) for a day.
 */
function getShiftSummary(dayData, bemanningsbehov) {
  const weekend = isWeekend(dayData.datum)
  const behov = weekend ? bemanningsbehov?.helg : bemanningsbehov?.vardag

  const sumRoles = (shiftBehov) => {
    if (!shiftBehov) return null
    return Object.values(shiftBehov).reduce((sum, n) => sum + n, 0)
  }

  return {
    dag:   { actual: dayData.dag.length,   required: sumRoles(behov?.dag) },
    kvall: { actual: dayData.kvall.length,  required: sumRoles(behov?.kvall) },
    natt:  { actual: dayData.natt.length,   required: sumRoles(behov?.natt) },
  }
}

// --- Main Component ---

function ScheduleCalendar({ scheduleData, selectedMonth, monthLabel, onBack }) {
  const [viewMode, setViewMode] = useState('calendar')
  const [selectedDay, setSelectedDay] = useState(null)
  const [bemanningsbehov, setBemanningsbehov] = useState(null)

  useEffect(() => {
    loadRequirements().then(setBemanningsbehov)
  }, [])

  // Derived data
  const calendarGrid = useMemo(
    () => buildCalendarGrid(selectedMonth),
    [selectedMonth]
  )

  const groupedDays = useMemo(
    () => groupScheduleByDay(scheduleData.schema),
    [scheduleData]
  )

  const dayMap = useMemo(() => {
    const m = {}
    for (const d of groupedDays) m[d.datum] = d
    return m
  }, [groupedDays])

  const dayStatusMap = useMemo(() => {
    const m = {}
    const konflikter = scheduleData.konflikter || []
    for (const d of groupedDays) {
      m[d.datum] = getDayStatus(d.datum, d, konflikter)
    }
    return m
  }, [groupedDays, scheduleData.konflikter])

  // Selected day data for modal
  const selectedDayData = selectedDay ? dayMap[selectedDay] : null

  const handleExportExcel = () => {
    window.open(API_ENDPOINTS.scheduleExport(selectedMonth), '_blank')
  }

  return (
    <div className="cal-container">
      {/* Header */}
      <div className="cal-header">
        <h2>Schema for {monthLabel}</h2>
        <div className="cal-header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn${viewMode === 'calendar' ? ' active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              Kalender
            </button>
            <button
              className={`view-toggle-btn${viewMode === 'person' ? ' active' : ''}`}
              onClick={() => setViewMode('person')}
            >
              Per person
            </button>
          </div>
          <button className="button-export" onClick={handleExportExcel}>
            Exportera Excel
          </button>
          <button className="button-back" onClick={onBack}>
            Tillbaka
          </button>
        </div>
      </div>

      {/* Metrics */}
      {scheduleData.metrics && (
        <div className="cal-metrics">
          <span>Tackning: {scheduleData.metrics.coverage_percent}%</span>
          <span>Overtid: {scheduleData.metrics.overtime_hours}h</span>
          <span>Kvalitet: {scheduleData.metrics.quality_score}/100</span>
        </div>
      )}

      {/* Conflicts summary */}
      {scheduleData.konflikter?.length > 0 && (
        <div className="cal-conflicts">
          <div className="cal-conflicts-warning">
            {scheduleData.konflikter.length} konflikt(er) i schemat:
          </div>
          <ul className="cal-conflicts-list">
            {scheduleData.konflikter.map((k, i) => (
              <li key={i} className="cal-conflicts-item">
                {k.datum && <strong>{k.datum}</strong>}
                {k.pass && <span> ({k.pass})</span>}
                {' \u2014 '}{k.beskrivning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="cal-grid">
          {/* Weekday headers */}
          {WEEKDAY_HEADERS.map((d, i) => (
            <div key={d} className={`cal-header-cell${i >= 5 ? ' weekend' : ''}`}>
              {d}
            </div>
          ))}

          {/* Day cells */}
          {calendarGrid.flat().map((dateStr, i) => {
            if (!dateStr) {
              return <div key={`empty-${i}`} className="cal-cell empty" />
            }

            const dayData = dayMap[dateStr]
            const status = dayStatusMap[dateStr] || (dayData ? 'ok' : 'error')
            const weekend = isWeekend(dateStr)
            const dayNum = parseInt(dateStr.split('-')[2])
            const summary = dayData && bemanningsbehov
              ? getShiftSummary(dayData, bemanningsbehov)
              : null

            return (
              <div
                key={dateStr}
                className={`cal-cell status-${status}${weekend ? ' weekend' : ''}`}
                onClick={() => setSelectedDay(dateStr)}
              >
                <div className="cal-cell-date">{dayNum}</div>
                {summary && (
                  <div className="cal-cell-shifts">
                    <span className={summary.dag.required === null || summary.dag.actual >= summary.dag.required ? 'shift-ok' : 'shift-short'}>
                      Dag {summary.dag.actual}{summary.dag.required !== null ? `/${summary.dag.required}` : ''}
                    </span>
                    <span className={summary.kvall.required === null || summary.kvall.actual >= summary.kvall.required ? 'shift-ok' : 'shift-short'}>
                      Kväll {summary.kvall.actual}{summary.kvall.required !== null ? `/${summary.kvall.required}` : ''}
                    </span>
                    <span className={summary.natt.required === null || summary.natt.actual >= summary.natt.required ? 'shift-ok' : 'shift-short'}>
                      Natt {summary.natt.actual}{summary.natt.required !== null ? `/${summary.natt.required}` : ''}
                    </span>
                  </div>
                )}
                {!summary && dayData && (
                  <div className="cal-cell-shifts">
                    <span>Dag {dayData.dag.length}</span>
                    <span>Kväll {dayData.kvall.length}</span>
                    <span>Natt {dayData.natt.length}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Person Timeline View */}
      {viewMode === 'person' && (
        <PersonTimeline
          scheduleData={scheduleData}
          selectedMonth={selectedMonth}
          onDayClick={(datum) => setSelectedDay(datum)}
        />
      )}

      {/* Day Detail Modal */}
      {selectedDay && selectedDayData && (
        <DayModal
          datum={selectedDay}
          dayData={selectedDayData}
          konflikter={scheduleData.konflikter}
          bemanningsbehov={bemanningsbehov}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}

export default ScheduleCalendar
