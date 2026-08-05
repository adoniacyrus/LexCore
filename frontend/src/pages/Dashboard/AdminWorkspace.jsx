import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, listEmployees } from '../../services/employeeService';
import './adminWorkspace.css';

const ROLE_LABELS = {
  ADMIN: 'Firm Administrator',
  SENIOR_LAWYER: 'Senior Advocate',
  JUNIOR_LAWYER: 'Junior Advocate',
  PARALEGAL: 'Paralegal',
};

/**
 * Admin home — dense layout backed only by Employee Management data.
 */
function AdminWorkspace() {
  const { accessToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listEmployees(accessToken);
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load staff directory.'));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.length - activeCount;
  const adminCount = employees.filter((e) => e.role === 'ADMIN').length;
  const recent = employees.slice(0, 6);

  return (
    <div className="admin-home lw-fade-in">
      <header className="admin-home__header">
        <div>
          <p className="section-tag-gold">Firm Administration</p>
          <h1 className="admin-home__title">Staff Directory</h1>
          <p className="admin-home__desc">
            Provision accounts, review roles, and manage chamber access.
          </p>
        </div>
        <Link to="/dashboard/admin/employees" className="btn btn-primary">
          Manage Users
        </Link>
      </header>

      {error ? (
        <p className="admin-home__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-home__stats" aria-label="Staff overview">
        {loading ? (
          <p className="lw-muted">Loading staff overview…</p>
        ) : (
          <>
            <article className="admin-stat">
              <p className="admin-stat__value">{employees.length}</p>
              <p className="admin-stat__label">Total Staff</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat__value">{activeCount}</p>
              <p className="admin-stat__label">Active</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat__value">{inactiveCount}</p>
              <p className="admin-stat__label">Inactive</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat__value">{adminCount}</p>
              <p className="admin-stat__label">Administrators</p>
            </article>
          </>
        )}
      </section>

      <section className="admin-home__panel" aria-labelledby="recent-staff-heading">
        <div className="admin-home__panel-head">
          <div>
            <h2 id="recent-staff-heading">Recent Staff</h2>
            <p>Latest accounts in the employee directory.</p>
          </div>
          <Link to="/dashboard/admin/employees" className="btn btn-ghost-dark">
            View all
          </Link>
        </div>

        {loading ? (
          <p className="lw-muted admin-home__panel-pad">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="admin-home__panel-pad">
            <EmptyState
              compact
              eyebrow="Staff"
              title="No staff accounts yet"
              description="Add your first employee to provision chambers access."
              action={
                <Link to="/dashboard/admin/employees" className="btn btn-primary">
                  Add Employee
                </Link>
              }
            />
          </div>
        ) : (
          <div className="admin-home__table-wrap">
            <table className="admin-home__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((emp) => (
                  <tr key={emp.id}>
                    <td className="admin-home__name">{emp.full_name}</td>
                    <td>{emp.email}</td>
                    <td>{ROLE_LABELS[emp.role] || emp.role}</td>
                    <td>
                      <span
                        className={`admin-home__status ${emp.is_active ? 'is-active' : 'is-inactive'}`}
                      >
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {emp.created_at
                        ? new Date(emp.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminWorkspace;
