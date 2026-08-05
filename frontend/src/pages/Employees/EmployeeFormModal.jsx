import React, { useEffect, useRef, useState } from 'react';
import {
  createEmployee,
  getErrorMessage,
  updateEmployee,
} from '../../services/employeeService';
import { listPracticeAreas } from '../../services/consultationService';

const EMPLOYEE_ROLES = [
  { value: 'ADMIN', label: 'Firm Administrator' },
  { value: 'SENIOR_LAWYER', label: 'Senior Advocate' },
  { value: 'JUNIOR_LAWYER', label: 'Junior Advocate' },
  { value: 'PARALEGAL', label: 'Paralegal' },
];

const LAWYER_ROLES = new Set(['SENIOR_LAWYER', 'JUNIOR_LAWYER']);

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone_number: '',
  role: 'PARALEGAL',
  practice_area_ids: [],
};

function EmployeeFormModal({ open, mode = 'create', employee = null, accessToken, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY_FORM);
  const [practiceAreas, setPracticeAreas] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && employee) {
      setForm({
        full_name: employee.full_name || '',
        email: employee.email || '',
        phone_number: employee.phone_number || '',
        role: employee.role || 'PARALEGAL',
        practice_area_ids: Array.isArray(employee.practice_areas)
          ? employee.practice_areas.map((a) => a.id)
          : [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
    setSubmitting(false);
    backdropPointerDown.current = false;
  }, [open, isEdit, employee]);

  useEffect(() => {
    if (!open || !accessToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listPracticeAreas(accessToken);
        if (!cancelled) setPracticeAreas(Array.isArray(data) ? data.filter((a) => a.is_active) : []);
      } catch {
        if (!cancelled) setPracticeAreas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  if (!open) return null;

  const isLawyer = LAWYER_ROLES.has(form.role);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'role' && !LAWYER_ROLES.has(value) ? { practice_area_ids: [] } : null),
    }));
  };

  const togglePracticeArea = (id) => {
    setForm((prev) => {
      const has = prev.practice_area_ids.includes(id);
      return {
        ...prev,
        practice_area_ids: has
          ? prev.practice_area_ids.filter((x) => x !== id)
          : [...prev.practice_area_ids, id],
      };
    });
  };

  const handleBackdropPointerDown = (e) => {
    backdropPointerDown.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e) => {
    if (backdropPointerDown.current && e.target === e.currentTarget) {
      onClose?.();
    }
    backdropPointerDown.current = false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim() || !form.email.trim() || !form.role) {
      setError('Please complete all required fields.');
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      role: form.role,
      practice_area_ids: isLawyer ? form.practice_area_ids : [],
    };

    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateEmployee(accessToken, employee.id, payload)
        : await createEmployee(accessToken, payload);
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(
        getErrorMessage(err, isEdit ? 'Unable to update employee.' : 'Unable to create employee.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="emp-modal-overlay"
      role="presentation"
      onMouseDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
      <div
        className="emp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-form-title"
      >
        <header className="emp-modal-header">
          <div>
            <p className="section-tag-gold">Employee Management</p>
            <h2 id="emp-form-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
          </div>
          <button type="button" className="emp-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <form className="emp-form auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field emp-field">
            <span>Full Name</span>
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={onChange}
              placeholder="Full legal name"
              required
            />
          </label>

          <label className="auth-field emp-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="name@lexcore.com"
              required
            />
          </label>

          <label className="auth-field emp-field">
            <span>Phone Number</span>
            <input
              name="phone_number"
              type="tel"
              value={form.phone_number}
              onChange={onChange}
              placeholder="+91 XXXXX XXXXX"
            />
          </label>

          <label className="auth-field emp-field">
            <span>Role</span>
            <select name="role" value={form.role} onChange={onChange} required>
              {EMPLOYEE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          {isLawyer ? (
            <fieldset className="emp-practice-areas">
              <legend>Practice Area Specializations</legend>
              <p className="emp-form-note auth-sheet-lede">
                Select one or more practice areas. Include General Consultation for intake matters.
              </p>
              <div className="emp-practice-areas__list">
                {practiceAreas.map((area) => (
                  <label key={area.id} className="emp-practice-areas__item">
                    <input
                      type="checkbox"
                      checked={form.practice_area_ids.includes(area.id)}
                      onChange={() => togglePracticeArea(area.id)}
                    />
                    {area.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {!isEdit ? (
            <p className="emp-form-note auth-sheet-lede">
              A secure temporary password will be generated and emailed to the employee.
            </p>
          ) : (
            <p className="emp-form-note auth-sheet-lede">
              Profile changes apply immediately. Use Force Reset Password to issue a new temporary password.
            </p>
          )}

          {error ? <p className="emp-error" role="alert">{error}</p> : null}

          <div className="emp-modal-actions">
            <button type="button" className="btn btn-ghost-dark" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save Changes'
                  : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeFormModal;
