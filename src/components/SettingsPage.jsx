import { useState, useEffect } from 'react';
import {
  loadStaffData,
  saveStaffData,
  loadRequirements,
  saveRequirements,
  resetToBaseline,
  hasLocalChanges,
} from '../utils/storage';
import './SettingsPage.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LABELS = {
  Mon: 'Mån',
  Tue: 'Tis',
  Wed: 'Ons',
  Thu: 'Tor',
  Fri: 'Fre',
  Sat: 'Lör',
  Sun: 'Sön',
};

const ROLES = ['sjukskoterska', 'underskoterska', 'lakare'];
const ROLE_LABELS = {
  sjukskoterska: 'Sjuksköterska',
  underskoterska: 'Undersköterska',
  lakare: 'Läkare',
};

function SettingsPage({ onBack }) {
  const [personal, setPersonal] = useState([]);
  const [bemanningsbehov, setBemanningsbehov] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [editingPerson, setEditingPerson] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffData, reqData] = await Promise.all([
        loadStaffData(),
        loadRequirements(),
      ]);

      // Säkerställ att personal är en array
      const safeStaffData = Array.isArray(staffData) ? staffData : [];
      if (!Array.isArray(staffData)) {
        console.error('staffData is not an array:', staffData);
      }

      setPersonal(safeStaffData);
      setBemanningsbehov(reqData);
      setHasChanges(hasLocalChanges());

      // Visa varning om ingen data laddades
      if (safeStaffData.length === 0 && !reqData) {
        setError('Kunde inte ladda data från backend. Kontrollera att backend-servern körs.');
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
      setError(`Fel vid laddning: ${err.message}`);
    }
    setLoading(false);
  };

  const handleSavePersonal = () => {
    saveStaffData(personal);
    setHasChanges(true);
  };

  const handleSaveRequirements = () => {
    saveRequirements(bemanningsbehov);
    setHasChanges(true);
  };

  const handleReset = async () => {
    if (window.confirm('Vill du verkligen återställa till originaldata? Alla lokala ändringar går förlorade.')) {
      const { personal: resetPersonal, bemanningsbehov: resetReq } = await resetToBaseline();
      setPersonal(resetPersonal || []);
      setBemanningsbehov(resetReq);
      setHasChanges(false);
    }
  };

  const handlePersonChange = (index, field, value) => {
    const updated = [...personal];
    updated[index] = { ...updated[index], [field]: value };
    setPersonal(updated);
  };

  const handleAvailabilityChange = (index, day) => {
    const updated = [...personal];
    const person = updated[index];
    const tillganglighet = person.tillganglighet || [];

    if (tillganglighet.includes(day)) {
      updated[index] = {
        ...person,
        tillganglighet: tillganglighet.filter((d) => d !== day),
      };
    } else {
      updated[index] = {
        ...person,
        tillganglighet: [...tillganglighet, day],
      };
    }
    setPersonal(updated);
  };

  const handleAddPerson = () => {
    const newPerson = {
      namn: 'Ny person',
      roll: 'underskoterska',
      anstallning: 100,
      tillganglighet: [...WEEKDAYS],
      franvaro: [],
    };
    setPersonal([...personal, newPerson]);
    setEditingPerson(personal.length);
  };

  const handleRemovePerson = (index) => {
    if (window.confirm(`Vill du ta bort ${personal[index].namn}?`)) {
      const updated = personal.filter((_, i) => i !== index);
      setPersonal(updated);
      setEditingPerson(null);
    }
  };

  const handleRequirementChange = (dayType, shift, role, value) => {
    const numValue = parseInt(value, 10) || 0;
    setBemanningsbehov((prev) => ({
      ...prev,
      [dayType]: {
        ...prev[dayType],
        [shift]: {
          ...prev[dayType][shift],
          [role]: numValue,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Laddar inställningar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Inställningar</h2>
        <div className="settings-header-actions">
          {hasChanges && (
            <span className="changes-indicator">Lokala ändringar finns</span>
          )}
          <button className="button-back" onClick={onBack}>
            Tillbaka
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">!</span>
          <span>{error}</span>
          <button className="retry-button" onClick={loadData}>
            Försök igen
          </button>
        </div>
      )}

      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Personal ({Array.isArray(personal) ? personal.length : 0})
        </button>
        <button
          className={`tab-button ${activeTab === 'bemanningsbehov' ? 'active' : ''}`}
          onClick={() => setActiveTab('bemanningsbehov')}
        >
          Bemanningsbehov
        </button>
      </div>

      {activeTab === 'personal' && (
        <div className="settings-section">
          <div className="section-header">
            <h3>Personal</h3>
            <button className="button-add" onClick={handleAddPerson}>
              + Lägg till
            </button>
          </div>

          <div className="staff-list">
            {(!Array.isArray(personal) || personal.length === 0) && (
              <div className="empty-state">
                <p>Ingen personal hittades. Klicka på "+ Lägg till" för att lägga till personal.</p>
              </div>
            )}
            {Array.isArray(personal) && personal.map((person, index) => (
              <div
                key={index}
                className={`staff-card ${editingPerson === index ? 'editing' : ''}`}
              >
                <div
                  className="staff-card-header"
                  onClick={() =>
                    setEditingPerson(editingPerson === index ? null : index)
                  }
                >
                  <div className="staff-info">
                    <span className="staff-name">{person.namn}</span>
                    <span className="staff-role">
                      {ROLE_LABELS[person.roll] || person.roll}
                    </span>
                    <span className="staff-employment">{person.anstallning}%</span>
                  </div>
                  <span className="expand-icon">
                    {editingPerson === index ? '▼' : '▶'}
                  </span>
                </div>

                {editingPerson === index && (
                  <div className="staff-card-body">
                    <div className="form-row">
                      <label>Namn:</label>
                      <input
                        type="text"
                        value={person.namn}
                        onChange={(e) =>
                          handlePersonChange(index, 'namn', e.target.value)
                        }
                      />
                    </div>

                    <div className="form-row">
                      <label>Roll:</label>
                      <select
                        value={person.roll}
                        onChange={(e) =>
                          handlePersonChange(index, 'roll', e.target.value)
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>Anställning (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={person.anstallning}
                        onChange={(e) =>
                          handlePersonChange(
                            index,
                            'anstallning',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </div>

                    <div className="form-row">
                      <label>Tillgänglighet:</label>
                      <div className="weekday-checkboxes">
                        {WEEKDAYS.map((day) => (
                          <label key={day} className="weekday-checkbox">
                            <input
                              type="checkbox"
                              checked={(person.tillganglighet || []).includes(day)}
                              onChange={() => handleAvailabilityChange(index, day)}
                            />
                            {WEEKDAY_LABELS[day]}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="staff-card-actions">
                      <button
                        className="button-danger"
                        onClick={() => handleRemovePerson(index)}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="section-actions">
            <button className="button-primary" onClick={handleSavePersonal}>
              Spara personal
            </button>
          </div>
        </div>
      )}

      {activeTab === 'bemanningsbehov' && bemanningsbehov && (
        <div className="settings-section">
          <div className="section-header">
            <h3>Bemanningsbehov</h3>
          </div>

          {['vardag', 'helg'].map((dayType) => (
            <div key={dayType} className="requirements-group">
              <h4>{dayType === 'vardag' ? 'Vardag' : 'Helg'}</h4>
              <table className="requirements-table">
                <thead>
                  <tr>
                    <th>Pass</th>
                    {ROLES.map((role) => (
                      <th key={role}>{ROLE_LABELS[role]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['dag', 'kvall', 'natt'].map((shift) => (
                    <tr key={shift}>
                      <td className="shift-label">
                        {shift === 'dag'
                          ? 'Dag'
                          : shift === 'kvall'
                          ? 'Kväll'
                          : 'Natt'}
                      </td>
                      {ROLES.map((role) => (
                        <td key={role}>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={bemanningsbehov[dayType]?.[shift]?.[role] || 0}
                            onChange={(e) =>
                              handleRequirementChange(
                                dayType,
                                shift,
                                role,
                                e.target.value
                              )
                            }
                            className="requirement-input"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="section-actions">
            <button className="button-primary" onClick={handleSaveRequirements}>
              Spara bemanningsbehov
            </button>
          </div>
        </div>
      )}

      <div className="settings-footer">
        <button className="button-danger-outline" onClick={handleReset}>
          Återställ till original
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
