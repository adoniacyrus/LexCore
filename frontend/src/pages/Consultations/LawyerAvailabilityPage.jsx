import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import {
  createDateOverride,
  createTimeBlock,
  deleteDateOverride,
  deleteTimeBlock,
  fetchLawyerSchedule,
  getErrorMessage,
  listDateOverrides,
  listTimeBlocks,
  updateLawyerSchedule,
} from '../../services/consultationService';
import './consultations.css';

const WEEKDAYS = [
  { id: 0, label: 'Monday' },
  { id: 1, label: 'Tuesday' },
  { id: 2, label: 'Wednesday' },
  { id: 3, label: 'Thursday' },
  { id: 4, label: 'Friday' },
  { id: 5, label: 'Saturday' },
  { id: 6, label: 'Sunday' },
];

const BLOCK_REASONS = [
  { value: 'COURT', label: 'Court Appearance' },
  { value: 'PERSONAL', label: 'Personal Commitment' },
  { value: 'MEETING', label: 'Internal Meeting' },
  { value: 'LEAVE', label: 'Leave / Travel' },
  { value: 'OTHER', label: 'Other Professional Commitment' },
];

function LawyerAvailabilityPage() {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' | 'overrides' | 'blocks'

  // Schedule state
  const [duration, setDuration] = useState(30);
  const [isAvailable, setIsAvailable] = useState(true);
  const [scheduleByDay, setScheduleByDay] = useState(() => {
    const init = {};
    WEEKDAYS.forEach((w) => {
      init[w.id] = {
        active: w.id < 5, // Mon-Fri active by default
        periods: [{ start_time: '10:00', end_time: '17:00' }],
      };
    });
    return init;
  });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  // Overrides state
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [newOverride, setNewOverride] = useState({
    start_date: '',
    end_date: '',
    is_unavailable: true,
    start_time: '10:00',
    end_time: '13:00',
    reason: '',
  });
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  // Blocks state
  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [newBlock, setNewBlock] = useState({
    date: '',
    start_time: '14:00',
    end_time: '16:00',
    reason: 'COURT',
    notes: '',
  });
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [blockError, setBlockError] = useState('');

  // Load schedule
  const loadScheduleData = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSchedule(true);
    setScheduleError('');
    try {
      const data = await fetchLawyerSchedule(accessToken);
      if (data) {
        setDuration(data.consultation_duration || 30);
        setIsAvailable(data.is_available !== false);

        const newMap = {};
        WEEKDAYS.forEach((w) => {
          newMap[w.id] = { active: false, periods: [] };
        });

        if (Array.isArray(data.weekly_schedules) && data.weekly_schedules.length > 0) {
          data.weekly_schedules.forEach((item) => {
            const day = item.weekday;
            if (newMap[day]) {
              newMap[day].active = true;
              newMap[day].periods.push({
                start_time: item.start_time.substring(0, 5),
                end_time: item.end_time.substring(0, 5),
              });
            }
          });
          // Ensure every active day has at least one period
          WEEKDAYS.forEach((w) => {
            if (!newMap[w.id].active || newMap[w.id].periods.length === 0) {
              newMap[w.id].periods = [{ start_time: '10:00', end_time: '17:00' }];
            }
          });
        } else {
          // Defaults for new lawyer profile
          WEEKDAYS.forEach((w) => {
            newMap[w.id] = {
              active: w.id < 5,
              periods: [
                { start_time: '10:00', end_time: '13:00' },
                { start_time: '14:00', end_time: '17:00' },
              ],
            };
          });
        }
        setScheduleByDay(newMap);
      }
    } catch (err) {
      setScheduleError(getErrorMessage(err, 'Failed to load consultation schedule.'));
    } finally {
      setLoadingSchedule(false);
    }
  }, [accessToken]);

  // Load overrides
  const loadOverridesData = useCallback(async () => {
    if (!accessToken) return;
    setLoadingOverrides(true);
    setOverrideError('');
    try {
      const data = await listDateOverrides(accessToken);
      setOverrides(Array.isArray(data) ? data : []);
    } catch (err) {
      setOverrideError(getErrorMessage(err, 'Failed to load date overrides.'));
    } finally {
      setLoadingOverrides(false);
    }
  }, [accessToken]);

  // Load blocks
  const loadBlocksData = useCallback(async () => {
    if (!accessToken) return;
    setLoadingBlocks(true);
    setBlockError('');
    try {
      const data = await listTimeBlocks(accessToken);
      setBlocks(Array.isArray(data) ? data : []);
    } catch (err) {
      setBlockError(getErrorMessage(err, 'Failed to load time blocks.'));
    } finally {
      setLoadingBlocks(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadScheduleData();
    loadOverridesData();
    loadBlocksData();
  }, [loadScheduleData, loadOverridesData, loadBlocksData]);

  // Schedule mutations
  const toggleDay = (dayId) => {
    setScheduleByDay((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        active: !prev[dayId].active,
      },
    }));
  };

  const addPeriod = (dayId) => {
    setScheduleByDay((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        periods: [...prev[dayId].periods, { start_time: '14:00', end_time: '17:00' }],
      },
    }));
  };

  const removePeriod = (dayId, index) => {
    setScheduleByDay((prev) => {
      const copy = [...prev[dayId].periods];
      copy.splice(index, 1);
      return {
        ...prev,
        [dayId]: {
          ...prev[dayId],
          periods: copy.length > 0 ? copy : [{ start_time: '10:00', end_time: '17:00' }],
        },
      };
    });
  };

  const updatePeriod = (dayId, index, field, value) => {
    setScheduleByDay((prev) => {
      const copy = [...prev[dayId].periods];
      copy[index] = { ...copy[index], [field]: value };
      return {
        ...prev,
        [dayId]: {
          ...prev[dayId],
          periods: copy,
        },
      };
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setScheduleError('');
    setScheduleSuccess('');
    setSavingSchedule(true);

    const flatSchedules = [];
    for (const w of WEEKDAYS) {
      const dayConfig = scheduleByDay[w.id];
      if (dayConfig && dayConfig.active) {
        for (const p of dayConfig.periods) {
          if (!p.start_time || !p.end_time) {
            setScheduleError(`Please specify start and end times for ${w.label}.`);
            setSavingSchedule(false);
            return;
          }
          if (p.start_time >= p.end_time) {
            setScheduleError(`Start time must be before end time for ${w.label} (${p.start_time} - ${p.end_time}).`);
            setSavingSchedule(false);
            return;
          }
          flatSchedules.push({
            weekday: w.id,
            start_time: p.start_time,
            end_time: p.end_time,
            is_active: true,
          });
        }
      }
    }

    const payload = {
      consultation_duration: Number(duration),
      is_available: isAvailable,
      weekly_schedules: flatSchedules,
    };

    try {
      await updateLawyerSchedule(accessToken, payload);
      setScheduleSuccess('Consultation working hours saved successfully.');
      setTimeout(() => setScheduleSuccess(''), 4000);
    } catch (err) {
      setScheduleError(getErrorMessage(err, 'Failed to save consultation schedule.'));
    } finally {
      setSavingSchedule(false);
    }
  };

  // Overrides mutations
  const handleCreateOverride = async (e) => {
    e.preventDefault();
    setOverrideError('');
    if (!newOverride.start_date) {
      setOverrideError('Start date is required.');
      return;
    }
    const endDate = newOverride.end_date || newOverride.start_date;
    if (endDate < newOverride.start_date) {
      setOverrideError('End date cannot be before start date.');
      return;
    }
    if (!newOverride.is_unavailable && newOverride.start_time >= newOverride.end_time) {
      setOverrideError('Start time must be before end time.');
      return;
    }

    setSubmittingOverride(true);
    const payload = {
      start_date: newOverride.start_date,
      end_date: endDate,
      is_unavailable: newOverride.is_unavailable,
      start_time: newOverride.is_unavailable ? null : newOverride.start_time,
      end_time: newOverride.is_unavailable ? null : newOverride.end_time,
      reason: newOverride.reason.trim(),
    };

    try {
      await createDateOverride(accessToken, payload);
      setNewOverride({
        start_date: '',
        end_date: '',
        is_unavailable: true,
        start_time: '10:00',
        end_time: '13:00',
        reason: '',
      });
      await loadOverridesData();
    } catch (err) {
      setOverrideError(getErrorMessage(err, 'Failed to create date override.'));
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleDeleteOverride = async (id) => {
    try {
      await deleteDateOverride(accessToken, id);
      await loadOverridesData();
    } catch (err) {
      setOverrideError(getErrorMessage(err, 'Failed to delete date override.'));
    }
  };

  // Blocks mutations
  const handleCreateBlock = async (e) => {
    e.preventDefault();
    setBlockError('');
    if (!newBlock.date) {
      setBlockError('Date is required.');
      return;
    }
    if (!newBlock.start_time || !newBlock.end_time) {
      setBlockError('Start time and end time are required.');
      return;
    }
    if (newBlock.start_time >= newBlock.end_time) {
      setBlockError('Start time must be before end time.');
      return;
    }

    setSubmittingBlock(true);
    try {
      await createTimeBlock(accessToken, {
        date: newBlock.date,
        start_time: newBlock.start_time,
        end_time: newBlock.end_time,
        reason: newBlock.reason,
        notes: newBlock.notes.trim(),
      });
      setNewBlock({
        date: '',
        start_time: '14:00',
        end_time: '16:00',
        reason: 'COURT',
        notes: '',
      });
      await loadBlocksData();
    } catch (err) {
      setBlockError(getErrorMessage(err, 'Failed to create time block.'));
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleDeleteBlock = async (id) => {
    try {
      await deleteTimeBlock(accessToken, id);
      await loadBlocksData();
    } catch (err) {
      setBlockError(getErrorMessage(err, 'Failed to delete time block.'));
    }
  };

  return (
    <DashboardLayout showContext={false} activeModule="consultation-availability" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in" style={{ padding: '0.8rem 1.2rem', overflowY: 'auto' }}>
        <PageHeader
          eyebrow="Advocate Workspace"
          title="Consultation Availability & Working Hours"
          description="Configure your default weekly working hours, appointment slot duration, date overrides, and blocked periods."
        />

        {/* NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('weekly')}
            style={{
              padding: '0.45rem 0.9rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'weekly' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'weekly' ? 'var(--color-primary)' : '#555',
              fontWeight: activeTab === 'weekly' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Weekly Working Hours
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overrides')}
            style={{
              padding: '0.45rem 0.9rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overrides' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'overrides' ? 'var(--color-primary)' : '#555',
              fontWeight: activeTab === 'overrides' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Specific Date Overrides ({overrides.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('blocks')}
            style={{
              padding: '0.45rem 0.9rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'blocks' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'blocks' ? 'var(--color-primary)' : '#555',
              fontWeight: activeTab === 'blocks' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Blocked Time Periods ({blocks.length})
          </button>
        </div>

        {/* TAB 1: WEEKLY WORKING HOURS */}
        {activeTab === 'weekly' && (
          <div>
            {scheduleError ? <p className="cons-error" role="alert" style={{ marginBottom: '0.75rem' }}>{scheduleError}</p> : null}
            {scheduleSuccess ? <p className="cons-success" role="status" style={{ marginBottom: '0.75rem', padding: '0.5rem 0.8rem', background: '#f4fbf6', border: '1px solid #cce8d5', color: '#1b6e36', borderRadius: '4px', fontSize: '0.8rem' }}>{scheduleSuccess}</p> : null}

            {loadingSchedule ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
                Loading consultation schedule settings…
              </div>
            ) : (
              <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '780px' }}>
                {/* DURATION CONFIGURATION */}
                <div style={{ padding: '0.85rem 1rem', background: '#fcfaf6', border: '1px solid #ebdcc5', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--color-primary)', marginBottom: '0.35rem' }}>
                    Default Consultation Duration
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#555', marginBottom: '0.6rem' }}>
                    Choose the standard duration for client appointment slots generated on your calendar.
                  </div>
                  <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: duration === 30 ? 600 : 400 }}>
                      <input
                        type="radio"
                        name="duration"
                        value={30}
                        checked={duration === 30}
                        onChange={() => setDuration(30)}
                      />
                      30 Minutes (Recommended)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: duration === 45 ? 600 : 400 }}>
                      <input
                        type="radio"
                        name="duration"
                        value={45}
                        checked={duration === 45}
                        onChange={() => setDuration(45)}
                      />
                      45 Minutes
                    </label>
                  </div>
                </div>

                {/* DAYS WORKING SCHEDULE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#222', marginBottom: '0.2rem' }}>
                    Weekly Working Schedule
                  </div>
                  {WEEKDAYS.map((w) => {
                    const dayConfig = scheduleByDay[w.id] || { active: false, periods: [] };
                    return (
                      <div
                        key={w.id}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: dayConfig.active ? '#fff' : '#f9f8f7',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={dayConfig.active}
                              onChange={() => toggleDay(w.id)}
                            />
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: dayConfig.active ? '#111' : '#777' }}>
                              {w.label}
                            </span>
                          </label>
                          <span style={{ fontSize: '0.72rem', color: dayConfig.active ? 'var(--color-primary)' : '#999', fontWeight: 500 }}>
                            {dayConfig.active ? 'Available for Consultations' : 'Unavailable'}
                          </span>
                        </div>

                        {dayConfig.active && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1.5rem' }}>
                            {dayConfig.periods.map((p, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="time"
                                  value={p.start_time}
                                  onChange={(e) => updatePeriod(w.id, idx, 'start_time', e.target.value)}
                                  style={{ padding: '0.25rem 0.45rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#777' }}>to</span>
                                <input
                                  type="time"
                                  value={p.end_time}
                                  onChange={(e) => updatePeriod(w.id, idx, 'end_time', e.target.value)}
                                  style={{ padding: '0.25rem 0.45rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                />
                                {dayConfig.periods.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removePeriod(w.id, idx)}
                                    style={{ background: 'transparent', border: 'none', color: '#b23b3b', fontSize: '0.74rem', cursor: 'pointer', padding: '0.2rem' }}
                                    title="Remove this working period"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <div>
                              <button
                                type="button"
                                onClick={() => addPeriod(w.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--color-primary)',
                                  fontSize: '0.73rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                + Add another period
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingSchedule}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 1.2rem' }}
                  >
                    {savingSchedule ? 'Saving Schedule…' : 'Save Availability Schedule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: SPECIFIC DATE OVERRIDES */}
        {activeTab === 'overrides' && (
          <div style={{ maxWidth: '820px' }}>
            {overrideError ? <p className="cons-error" role="alert" style={{ marginBottom: '0.75rem' }}>{overrideError}</p> : null}

            {/* CREATE OVERRIDE FORM */}
            <form onSubmit={handleCreateOverride} style={{ padding: '0.85rem 1rem', background: '#fdfbf7', border: '1px solid #e7dcce', borderRadius: '6px', marginBottom: '1.2rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--color-primary)', marginBottom: '0.6rem' }}>
                Add Specific Date Override
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <label className="auth-field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={newOverride.start_date}
                    onChange={(e) => setNewOverride((p) => ({ ...p, start_date: e.target.value }))}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>End Date (Optional)</span>
                  <input
                    type="date"
                    value={newOverride.end_date}
                    onChange={(e) => setNewOverride((p) => ({ ...p, end_date: e.target.value }))}
                    placeholder="Same as start date"
                  />
                </label>
                <label className="auth-field">
                  <span>Availability Status</span>
                  <select
                    value={newOverride.is_unavailable ? 'UNAVAILABLE' : 'CUSTOM'}
                    onChange={(e) => setNewOverride((p) => ({ ...p, is_unavailable: e.target.value === 'UNAVAILABLE' }))}
                  >
                    <option value="UNAVAILABLE">Unavailable all day</option>
                    <option value="CUSTOM">Available with custom hours</option>
                  </select>
                </label>
              </div>

              {!newOverride.is_unavailable && (
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <label className="auth-field" style={{ flex: 1 }}>
                    <span>Start Time</span>
                    <input
                      type="time"
                      value={newOverride.start_time}
                      onChange={(e) => setNewOverride((p) => ({ ...p, start_time: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="auth-field" style={{ flex: 1 }}>
                    <span>End Time</span>
                    <input
                      type="time"
                      value={newOverride.end_time}
                      onChange={(e) => setNewOverride((p) => ({ ...p, end_time: e.target.value }))}
                      required
                    />
                  </label>
                </div>
              )}

              <div style={{ marginBottom: '0.65rem' }}>
                <label className="auth-field">
                  <span>Reason / Note</span>
                  <input
                    type="text"
                    value={newOverride.reason}
                    onChange={(e) => setNewOverride((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="e.g., Leave, Vacation, Special Evening Session"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingOverride}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
              >
                {submittingOverride ? 'Adding Override…' : '+ Add Date Override'}
              </button>
            </form>

            {/* ACTIVE OVERRIDES LIST */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#222', marginBottom: '0.45rem' }}>
                Configured Date Overrides
              </div>
              {loadingOverrides ? (
                <div style={{ padding: '1rem', color: '#666', fontSize: '0.8rem' }}>Loading overrides…</div>
              ) : overrides.length === 0 ? (
                <div style={{ padding: '1rem', background: '#fdfbf7', border: '1px dashed #dcd5ca', borderRadius: '4px', textAlign: 'center', fontSize: '0.78rem', color: '#777' }}>
                  No date overrides configured. Your default weekly schedule applies on all dates.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {overrides.map((ov) => (
                    <div
                      key={ov.id}
                      style={{
                        padding: '0.65rem 0.9rem',
                        background: '#fff',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#111' }}>
                          {ov.start_date} {ov.end_date && ov.end_date !== ov.start_date ? `to ${ov.end_date}` : ''}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: ov.is_unavailable ? '#b23b3b' : 'var(--color-primary)', fontWeight: 500 }}>
                          {ov.is_unavailable ? 'Unavailable All Day' : `Custom Hours: ${ov.start_time?.substring(0, 5)} – ${ov.end_time?.substring(0, 5)}`}
                          {ov.reason ? ` · ${ov.reason}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteOverride(ov.id)}
                        className="btn btn-ghost-dark"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', height: 'auto', minHeight: 'auto', color: '#b23b3b' }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BLOCKED TIME PERIODS */}
        {activeTab === 'blocks' && (
          <div style={{ maxWidth: '820px' }}>
            {blockError ? <p className="cons-error" role="alert" style={{ marginBottom: '0.75rem' }}>{blockError}</p> : null}

            {/* BLOCK TIME FORM */}
            <form onSubmit={handleCreateBlock} style={{ padding: '0.85rem 1rem', background: '#fdfbf7', border: '1px solid #e7dcce', borderRadius: '6px', marginBottom: '1.2rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--color-primary)', marginBottom: '0.6rem' }}>
                Block Specific Time Period
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <label className="auth-field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={newBlock.date}
                    onChange={(e) => setNewBlock((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Start Time</span>
                  <input
                    type="time"
                    value={newBlock.start_time}
                    onChange={(e) => setNewBlock((p) => ({ ...p, start_time: e.target.value }))}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>End Time</span>
                  <input
                    type="time"
                    value={newBlock.end_time}
                    onChange={(e) => setNewBlock((p) => ({ ...p, end_time: e.target.value }))}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Reason</span>
                  <select
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock((p) => ({ ...p, reason: e.target.value }))}
                  >
                    {BLOCK_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ marginBottom: '0.65rem' }}>
                <label className="auth-field">
                  <span>Notes (Optional)</span>
                  <input
                    type="text"
                    value={newBlock.notes}
                    onChange={(e) => setNewBlock((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="e.g., High Court bench appearance in courtroom 4"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingBlock}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
              >
                {submittingBlock ? 'Blocking Time…' : '+ Block Time'}
              </button>
            </form>

            {/* ACTIVE BLOCKS LIST */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#222', marginBottom: '0.45rem' }}>
                Active Time Blocks
              </div>
              {loadingBlocks ? (
                <div style={{ padding: '1rem', color: '#666', fontSize: '0.8rem' }}>Loading time blocks…</div>
              ) : blocks.length === 0 ? (
                <div style={{ padding: '1rem', background: '#fdfbf7', border: '1px dashed #dcd5ca', borderRadius: '4px', textAlign: 'center', fontSize: '0.78rem', color: '#777' }}>
                  No time blocks created. Consultation booking follows your weekly working hours.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {blocks.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '0.65rem 0.9rem',
                        background: '#fff',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#111' }}>
                          {b.date} · {b.start_time?.substring(0, 5)} – {b.end_time?.substring(0, 5)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#666', marginTop: '0.15rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{b.reason_label || b.reason}</span>
                          {b.notes ? ` · ${b.notes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(b.id)}
                        className="btn btn-ghost-dark"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', height: 'auto', minHeight: 'auto', color: '#b23b3b' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default LawyerAvailabilityPage;
