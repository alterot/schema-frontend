import { useState } from 'react'
import { mockPersonal, mockSchema } from './mockData.js'
import { generateSchedule } from './api/scheduleAgent.js'
import { USE_MOCK_MODE } from './config';
import SettingsPage from './components/SettingsPage';
import './App.css'

function App() {
  const [selectedMonth, setSelectedMonth] = useState('2025-04')
  const [specialConditions, setSpecialConditions] = useState('')
  const [view, setView] = useState('input') // input | loading | result | schedule | settings
  const [agentResult, setAgentResult] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [useAgent, setUseAgent] = useState(false) // Toggle mellan mock och agent

  const handleGenerateSchedule = async () => {
    setView('loading')
    setLoadingStatus('Startar...')

    if (useAgent && specialConditions.trim()) {
      // Anvand AI-agenten
      try {
        const result = await generateSchedule(
          specialConditions,
          selectedMonth,
          (progress) => {
            if (progress.status === 'calling_claude') {
              setLoadingStatus(`Iteration ${progress.iteration}: Analyserar med AI...`)
            } else if (progress.status === 'executing_tool') {
              setLoadingStatus(`Iteration ${progress.iteration}: Kor ${progress.toolName}...`)
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
    } else {
      // Anvand mock-data (fallback)
      setTimeout(() => {
        setAgentResult(null)
        setView('result')
      }, 2000)
    }
  }

  const handleAdjustInput = () => {
    setView('input')
  }

  const handleGenerateNewProposal = () => {
    setView('loading')

    setTimeout(() => {
      setView('result')
    }, 2000)
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
          <h1>Schemaläggningsassistent - Vårdavdelning 3B</h1>
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
      {USE_MOCK_MODE && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ⚠️ <strong>Mock Mode</strong> - AI-anrop simuleras (inga API-kostnader)
        </div>
      )}

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
              <option value="2025-04">April 2025</option>
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

          {/* Agent toggle */}
          <div className="control-group agent-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={useAgent}
                onChange={(e) => setUseAgent(e.target.checked)}
                disabled={view === 'loading'}
              />
              <span className="toggle-text">
                Använd AI-agent {USE_MOCK_MODE ? '(Mock Mode)' : '(kräver Cloudflare Worker)'}
              </span>
            </label>
            {useAgent && (
              <p className="toggle-hint">
                {USE_MOCK_MODE
                  ? 'Mock mode: Simulerar AI-agenten utan verkliga API-anrop.'
                  : 'AI-agenten analyserar din input och använder verktyg för att generera schema.'}
              </p>
            )}
          </div>

          <button
            className="generate-button"
            onClick={handleGenerateSchedule}
            disabled={view === 'loading'}
          >
            {view === 'loading' ? 'Genererar schema...' : (useAgent ? 'Generera med AI' : 'Generera schema')}
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
          <div className="interpreted-section">
            <h2>✅ Agenten tolkade din input som:</h2>
            <ul className="interpreted-list">
              {(agentResult?.tolkadInput || mockSchema.tolkadInput).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Agent response (om AI användes) */}
          {agentResult?.agentResponse && (
            <div className="agent-response-section">
              <h2>AI-assistentens analys:</h2>
              <div className="agent-response-text">
                {agentResult.agentResponse}
              </div>
            </div>
          )}

          {/* Konfliktlista */}
          {(agentResult?.konflikter || mockSchema.konflikter).length > 0 && (
            <div className="conflicts-section">
              <h2>⚠️ Konflikter upptäckta</h2>
              <p className="conflicts-subtitle">Följande konflikter hittades i det genererade schemat:</p>

              <ul className="conflicts-list">
                {(agentResult?.konflikter || mockSchema.konflikter).map((konflikt, index) => (
                  <li key={index} className="conflict-item">
                    <span className="conflict-icon">⚠️</span>
                    <div className="conflict-details">
                      <strong>{formatDate(konflikt.datum).date}</strong> - {konflikt.pass}
                      <p>{konflikt.beskrivning}</p>
                    </div>
                  </li>
                ))}
              </ul>
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
            <h2>Schema för {selectedMonth === '2025-04' ? 'April 2025' : selectedMonth}</h2>
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
