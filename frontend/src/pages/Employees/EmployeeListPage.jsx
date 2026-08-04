import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  deleteEmployee,
  forceResetEmployeePassword,
  getErrorMessage,
  listEmployees,
  setEmployeeActive,
} from '../../services/employeeService';
import EmployeeConfirmDialog from './EmployeeConfirmDialog';
import EmployeeFormModal from './EmployeeFormModal';
import './employees.css';

const ROLE_LABELS = {
  ADMIN: 'Firm Administrator',
  SENIOR_LAWYER: 'Senior Advocate',
  JUNIOR_LAWYER: 'Junior Advocate',
  PARALEGAL: 'Paralegal',
};

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Firm Administrator' },
  { value: 'SENIOR_LAWYER', label: 'Senior Advocate' },
  { value: 'JUNIOR_LAWYER', label: 'Junior Advocate' },
  { value: 'PARALEGAL', label: 'Paralegal' },
];

function ActionIcon({ name }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'edit':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case 'deactivate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'activate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'reset':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
    case 'delete':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M7 7l1 12h8l1-12" />
        </svg>
      );
    default:
      return null;
  }
}

function EmployeeListPage() {
  const { accessToken, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const loadEmployees = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listEmployees(accessToken);
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load employees.'));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (roleFilter && emp.role !== roleFilter) return false;
      if (!q) return true;
      return (
        emp.full_name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q)
      );
    });
  }, [employees, search, roleFilter]);

  const openCreate = () => {
    setFormMode('create');
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (emp) => {
    setFormMode('edit');
    setSelected(emp);
    setFormOpen(true);
  };

  const handleSaved = (result) => {
    showToast(
      result?.email_sent === false ? 'error' : 'success',
      result?.message || (formMode === 'edit' ? 'Employee updated.' : 'Employee created.')
    );
    loadEmployees();
  };

  const runConfirmedAction = async () => {
    if (!confirm || !accessToken) return;
    setActionBusy(true);
    try {
      let result;
      if (confirm.type === 'deactivate') {
        result = await setEmployeeActive(accessToken, confirm.employee.id, false);
      } else if (confirm.type === 'activate') {
        result = await setEmployeeActive(accessToken, confirm.employee.id, true);
      } else if (confirm.type === 'reset') {
        result = await forceResetEmployeePassword(accessToken, confirm.employee.id);
      } else if (confirm.type === 'delete') {
        result = await deleteEmployee(accessToken, confirm.employee.id);
      }
      showToast(
        result?.email_sent === false ? 'error' : 'success',
        result?.message || 'Action completed.'
      );
      setConfirm(null);
      loadEmployees();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Unable to complete this action.'));
    } finally {
      setActionBusy(false);
    }
  };

  const isSelf = (emp) => user?.id != null && emp.id === user.id;

  return (
    <DashboardLayout showContext={false} activeModule="users" fillHeight>
      <div className="emp-page emp-page--embedded lw-fade-in">
        <div className="emp-page-inner">
          <header className="emp-page-header lw-page-header emp-page-header--fixed">
            <div className="lw-page-header__copy">
              <p className="section-tag-gold">Employee Management</p>
              <h1 className="emp-title section-headline">Users</h1>
              <p className="emp-subtitle auth-sheet-lede">
                Provision and review internal staff accounts
                {user?.full_name ? ` · ${user.full_name}` : ''}.
              </p>
            </div>
            <div className="emp-header-actions">
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                Add Employee
              </button>
            </div>
          </header>

          <div className="emp-toolbar">
            <label className="emp-search">
              <span className="visually-hidden">Search</span>
              <input
                type="search"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="emp-filter">
              <span className="visually-hidden">Filter by role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                {ROLE_FILTERS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="emp-error" role="alert">{error}</p> : null}

          <div className="emp-table-wrap">
            {loading ? (
              <div className="emp-state">Loading employees…</div>
            ) : filtered.length === 0 ? (
              <div className="emp-state">
                {employees.length === 0
                  ? 'No employees yet. Add your first staff member to get started.'
                  : 'No employees match your search or filter.'}
              </div>
            ) : (
              <table className="emp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="emp-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const selfRow = isSelf(emp);
                    return (
                      <tr key={emp.id}>
                        <td>{emp.full_name}</td>
                        <td>{emp.email}</td>
                        <td>{emp.phone_number || '—'}</td>
                        <td>{ROLE_LABELS[emp.role] || emp.role}</td>
                        <td>
                          <span className={`emp-status ${emp.is_active ? 'is-active' : 'is-inactive'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {emp.created_at
                            ? new Date(emp.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="emp-actions-col">
                          <div className="emp-row-actions">
                            <button
                              type="button"
                              className="emp-action-btn"
                              title="Edit user"
                              aria-label={`Edit ${emp.full_name}`}
                              onClick={() => openEdit(emp)}
                            >
                              <ActionIcon name="edit" />
                            </button>
                            {emp.is_active ? (
                              <button
                                type="button"
                                className="emp-action-btn"
                                title="Deactivate user"
                                aria-label={`Deactivate ${emp.full_name}`}
                                disabled={selfRow}
                                onClick={() =>
                                  setConfirm({
                                    type: 'deactivate',
                                    employee: emp,
                                    title: 'Deactivate employee',
                                    message: `Deactivate ${emp.full_name}? They will be unable to sign in until reactivated.`,
                                    confirmLabel: 'Deactivate',
                                    tone: 'danger',
                                  })
                                }
                              >
                                <ActionIcon name="deactivate" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="emp-action-btn emp-action-btn--accent"
                                title="Activate user"
                                aria-label={`Activate ${emp.full_name}`}
                                onClick={() =>
                                  setConfirm({
                                    type: 'activate',
                                    employee: emp,
                                    title: 'Activate employee',
                                    message: `Reactivate ${emp.full_name}? They will regain portal access.`,
                                    confirmLabel: 'Activate',
                                    tone: 'primary',
                                  })
                                }
                              >
                                <ActionIcon name="activate" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="emp-action-btn"
                              title="Force reset password"
                              aria-label={`Force reset password for ${emp.full_name}`}
                              onClick={() =>
                                setConfirm({
                                  type: 'reset',
                                  employee: emp,
                                  title: 'Force reset password',
                                  message: `Reset password for ${emp.full_name}? A new temporary password will be emailed to ${emp.email}.`,
                                  confirmLabel: 'Reset Password',
                                  tone: 'primary',
                                })
                              }
                            >
                              <ActionIcon name="reset" />
                            </button>
                            <button
                              type="button"
                              className="emp-action-btn emp-action-btn--danger"
                              title="Delete user"
                              aria-label={`Delete ${emp.full_name}`}
                              disabled={selfRow}
                              onClick={() =>
                                setConfirm({
                                  type: 'delete',
                                  employee: emp,
                                  title: 'Delete employee',
                                  message: `Permanently delete ${emp.full_name}? This cannot be undone.`,
                                  confirmLabel: 'Delete',
                                  tone: 'danger',
                                })
                              }
                            >
                              <ActionIcon name="delete" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <EmployeeFormModal
          open={formOpen}
          mode={formMode}
          employee={selected}
          accessToken={accessToken}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />

        <EmployeeConfirmDialog
          open={Boolean(confirm)}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          tone={confirm?.tone}
          busy={actionBusy}
          onClose={() => {
            if (!actionBusy) setConfirm(null);
          }}
          onConfirm={runConfirmedAction}
        />

        {toast ? (
          <div className={`emp-toast emp-toast--${toast.type}`} role="status">
            {toast.message}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default EmployeeListPage;
