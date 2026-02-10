import { useState } from 'react'
import { mockPersonal, mockSchema } from './mockData.js'
import { generateSchedule } from './api/scheduleAgent.js'
import SettingsPage from './components/SettingsPage';
import './App.css'

// Generera månadslista dynamiskt
function getMonthOptions() {
  const now = new Date()
  const options = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

const monthOptions = getMonthOptions()

function App() {
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value)
  const [specialConditions, setSpecialConditions] = useState('')
  const [view, setView] = useState('input') // input | loading | result | schedule | settings
  const [agentResult, setAgentResult] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState('')
  const handleGenerateSchedule = async () => {
    setView('loading')
    setLoadingStatus('Startar...')

    const input = specialConditions.trim() || 'Generera ett standardschema utan särskilda villkor.'

    try {
      const result = await generateSchedule(
        input,
        selectedMonth,
        (progress) => {
          if (progress.status === 'calling_claude') {
            setLoadingStatus(`Iteration ${progress.iteration}: Analyserar med AI...`)
          } else if (progress.status === 'executing_tool') {
            setLoadingStatus(`Iteration ${progress.iteration}: Kör ${progress.toolName}...`)
          }
        }
      )
      setAgentResult(result)
      setView('result')
    } catch (error) {
      console.error('Agent error:', error)
      setAgentResult({
        success: false,
        error: error.message,
        tolkadInput: [],
        konflikter: [{
          datum: `${selectedMonth}-01`,
          pass: 'dag',
          beskrivning: `Fel: ${error.message}`,
          typ: 'error',
        }],
      })
      setView('result')
    }
  }

  const handleAdjustInput = () => {
    setView('input')
  }

  const handleGenerateNewProposal = () => {
    handleGenerateSchedule()
  }

  const handleShowSchedule = () => {
    setView('schedule')
  }

  // Funktion för att hämta personalnamn baserat på ID
  const getPersonalName = (id) => {
    const person = mockPersonal.find(p => p.id === id)
    return person ? person.namn : 'Okänd'
  }

  // Funktion för att formatera datum
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const weekdays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']
    return {
      date: dateString,
      weekday: weekdays[date.getDay()]
    }
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>Schemaläggningsassistent offentlig sektor</h1>
          {view !== 'settings' && (
            <button
              className="settings-button"
              onClick={() => setView('settings')}
              disabled={view === 'loading'}
            >
              Inställningar
            </button>
          )}
        </div>
      </header>

      {/* Kontrollpanel - visas alltid när vi inte är i schedule-läge */}
      {view !== 'schedule' && (
        <div className="control-panel">
          <div className="control-group">
            <label htmlFor="month-select">Välj månad:</label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-dropdown"
              disabled={view === 'loading'}
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="control-group full-width">
            <label htmlFor="special-conditions">Särskilda förutsättningar denna månad:</label>
            <textarea
              id="special-conditions"
              value={specialConditions}
              onChange={(e) => setSpecialConditions(e.target.value)}
              className="special-conditions-textarea"
              placeholder="Exempel:&#10;Anna semester 10-20 april&#10;David sjuk hela månaden&#10;Behöver +1 usk på dag vecka 15-16"
              rows="5"
              disabled={view === 'loading'}
            />
          </div>

          <button
            className="generate-button"
            onClick={handleGenerateSchedule}
            disabled={view === 'loading'}
          >
            {view === 'loading' ? 'Genererar schema...' : 'Generera schema'}
          </button>
        </div>
      )}

      {/* Loading state */}
      {view === 'loading' && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{loadingStatus || 'Genererar schema och analyserar förutsättningar...'}</p>
        </div>
      )}

      {/* Resultatsektion */}
      {view === 'result' && (
        <div className="result-container">
          {/* Tolkad input */}
          {agentResult?.tolkadInput?.length > 0 && (
            <div className="interpreted-section">
              <h2>Agenten tolkade din input som:</h2>
              <ul className="interpreted-list">
                {agentResult.tolkadInput.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent response */}
          {agentResult?.agentResponse && (
            <div className="agent-response-section">
              <h2>AI-assistentens analys:</h2>
              <div className="agent-response-text">
                {agentResult.agentResponse}
              </div>
            </div>
          )}

          {/* Konfliktlista */}
          {agentResult?.konflikter?.length > 0 && (
            <div className="conflicts-section">
              <h2>Konflikter upptäckta</h2>
              <p className="conflicts-subtitle">Följande konflikter hittades i det genererade schemat:</p>

              <ul className="conflicts-list">
                {agentResult.konflikter.map((konflikt, index) => (
                  <li key={index} className="conflict-item">
                    <span className="conflict-icon">!</span>
                    <div className="conflict-details">
                      <strong>{formatDate(konflikt.datum).date}</strong> - {konflikt.pass}
                      <p>{konflikt.beskrivning}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Felmeddelande om agenten misslyckades */}
          {agentResult && !agentResult.success && (
            <div className="conflicts-section">
              <h2>Något gick fel</h2>
              <p className="conflicts-subtitle">{agentResult.error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="result-actions">
            <button className="button-secondary" onClick={handleAdjustInput}>
              Justera input
            </button>
            <button className="button-secondary" onClick={handleGenerateNewProposal}>
              Generera nytt förslag
            </button>
            <button className="button-primary" onClick={handleShowSchedule}>
              Visa schema ändå
            </button>
          </div>
        </div>
      )}

      {/* Schemavy */}
      {view === 'schedule' && (
        <div className="schedule-container">
          <div className="schedule-header">
            <h2>Schema för {monthOptions.find(o => o.value === selectedMonth)?.label || selectedMonth}</h2>
            <button className="button-back" onClick={() => setView('result')}>
              ← Tillbaka till resultat
            </button>
          </div>

          {mockSchema.konflikter.length > 0 && (
            <div className="schedule-warning">
              ⚠️ Detta schema innehåller {mockSchema.konflikter.length} konflikt(er)
            </div>
          )}

          <div className="table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Dag</th>
                  <th>Kväll</th>
                  <th>Natt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockSchema.schema.map((day, index) => {
                  const dateInfo = formatDate(day.datum)
                  const hasConflict = mockSchema.konflikter.some(k => k.datum === day.datum)
                  const rowClass = hasConflict ? 'row-warning' : 'row-ok'

                  return (
                    <tr key={index} className={rowClass}>
                      <td className="date-cell">
                        <strong>{dateInfo.date}</strong>
                        <span className="weekday">{dateInfo.weekday}</span>
                      </td>
                      <td className="shift-cell">
                        {day.dag.map((id, i) => (
                          <div key={i} className="staff-name">{getPersonalName(id)}</div>
                        ))}
                      </td>
                      <td className="shift-cell">
                        {day.kvall.map((id, i) => (
                          <div key={i} className="staff-name">{getPersonalName(id)}</div>
                        ))}
                      </td>
                      <td className="shift-cell">
                        {day.natt.map((id, i) => (
                          <div key={i} className="staff-name">{getPersonalName(id)}</div>
                        ))}
                      </td>
                      <td className="status-cell">
                        {hasConflict ? (
                          <span className="status-icon warning">⚠️</span>
                        ) : (
                          <span className="status-icon ok">✅</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inställningar */}
      {view === 'settings' && (
        <SettingsPage onBack={() => setView('input')} />
      )}
    </div>
  )
}

export default App
