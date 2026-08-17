import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  deleteClient,
  forceResetClientPassword,
  getErrorMessage,
  listClients,
  setClientActive,
} from '../../services/clientService';
import ClientConfirmDialog from './ClientConfirmDialog';
import ClientFormModal from './ClientFormModal';
import './clients.css';

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ActionIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
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

function ClientListPage() {
  const { accessToken } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listClients(accessToken, {
        q: search.trim() || undefined,
        status: statusFilter || undefined,
        registration_method: methodFilter || undefined,
      });
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load clients.'));
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, statusFilter, methodFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedClients = useMemo(() => {
    return clients
      .slice()
      .sort((a, b) => {
        if (Boolean(a.is_active) === Boolean(b.is_active)) return 0;
        return a.is_active ? -1 : 1;
      });
  }, [clients]);

  const totalPages = Math.max(1, Math.ceil(sortedClients.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedClients.slice(start, start + PAGE_SIZE);
  }, [sortedClients, page]);

  const rangeStart = sortedClients.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, sortedClients.length);

  const openCreate = () => {
    setFormMode('create');
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (client) => {
    setFormMode('edit');
    setSelected(client);
    setFormOpen(true);
  };

  const handleSaved = (result) => {
    showToast(
      result?.email_sent === false ? 'error' : 'success',
      result?.message || (formMode === 'edit' ? 'Client updated.' : 'Client created.')
    );
    load();
  };

  const runConfirmedAction = async () => {
    if (!confirm || !accessToken) return;
    setActionBusy(true);
    try {
      let result;
      if (confirm.type === 'deactivate') {
        result = await setClientActive(accessToken, confirm.client.id, false);
      } else if (confirm.type === 'activate') {
        result = await setClientActive(accessToken, confirm.client.id, true);
      } else if (confirm.type === 'reset') {
        result = await forceResetClientPassword(accessToken, confirm.client.id);
      } else if (confirm.type === 'delete') {
        result = await deleteClient(accessToken, confirm.client.id);
      }
      showToast(
        result?.email_sent === false ? 'error' : 'success',
        result?.message || 'Action completed.'
      );
      setConfirm(null);
      load();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Unable to complete action.'));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <DashboardLayout showContext={false} activeModule="clients" fillHeight>
      <div className="lw-directory lw-fade-in">
        <PageHeader
          eyebrow="Firm Administration"
          title="Clients"
          description="Register and review LexCore client portal accounts."
          actions={
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Add Client
            </button>
          }
        />

        <div className="lw-directory__toolbar">
          <label className="lw-directory__search">
            <span className="lw-sr-only">Search</span>
            <input
              type="search"
              placeholder="Search name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            aria-label="Filter by registration method"
          >
            <option value="">All registration methods</option>
            <option value="SELF">Self Registered</option>
            <option value="ADMIN">Admin Registered</option>
          </select>
        </div>

        {error ? (
          <p className="lw-directory__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="lw-directory__table-wrap">
          {loading ? (
            <div className="cli-empty">Loading clients…</div>
          ) : sortedClients.length === 0 ? (
            <EmptyState
              eyebrow="Clients"
              title="No clients found"
              description="Add a client or adjust your search and filters."
              action={
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  Add Client
                </button>
              }
            />
          ) : (
            <table className="lw-directory__table cli-table">
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Account Status</th>
                  <th>Registration Method</th>
                  <th>Created Date</th>
                  <th className="lw-directory__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((client) => (
                  <tr
                    key={client.id}
                    className={client.is_active ? undefined : 'cli-row--inactive'}
                  >
                    <td className="cli-ref">{client.client_id}</td>
                    <td>{client.full_name}</td>
                    <td>{client.email}</td>
                    <td>{client.phone_number || '—'}</td>
                    <td>
                      <span
                        className={`cli-status ${client.is_active ? 'is-active' : 'is-inactive'}`}
                      >
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {client.registration_method_label ||
                        (client.registration_method === 'ADMIN'
                          ? 'Admin Registered'
                          : 'Self Registered')}
                    </td>
                    <td>{formatDate(client.created_at)}</td>
                    <td className="lw-directory__actions-col">
                      <div className="lw-directory__row-actions">
                        <button
                          type="button"
                          className="lw-directory__action-btn"
                          title="Edit client"
                          aria-label={`Edit ${client.full_name}`}
                          onClick={() => openEdit(client)}
                        >
                          <ActionIcon name="edit" />
                        </button>
                        {client.is_active ? (
                          <button
                            type="button"
                            className="lw-directory__action-btn"
                            title="Deactivate client"
                            aria-label={`Deactivate ${client.full_name}`}
                            onClick={() =>
                              setConfirm({
                                type: 'deactivate',
                                client,
                                title: 'Deactivate client',
                                message: `Deactivate ${client.full_name}? They will be unable to sign in until reactivated.`,
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
                            className="lw-directory__action-btn lw-directory__action-btn--accent"
                            title="Activate client"
                            aria-label={`Activate ${client.full_name}`}
                            onClick={() =>
                              setConfirm({
                                type: 'activate',
                                client,
                                title: 'Activate client',
                                message: `Reactivate ${client.full_name}? They will regain portal access.`,
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
                          className="lw-directory__action-btn"
                          title="Force reset password"
                          aria-label={`Force reset password for ${client.full_name}`}
                          onClick={() =>
                            setConfirm({
                              type: 'reset',
                              client,
                              title: 'Force reset password',
                              message: `Reset password for ${client.full_name}? A new temporary password will be emailed to ${client.email}.`,
                              confirmLabel: 'Reset Password',
                              tone: 'primary',
                            })
                          }
                        >
                          <ActionIcon name="reset" />
                        </button>
                        <button
                          type="button"
                          className="lw-directory__action-btn lw-directory__action-btn--danger"
                          title="Delete client"
                          aria-label={`Delete ${client.full_name}`}
                          onClick={() =>
                            setConfirm({
                              type: 'delete',
                              client,
                              title: 'Delete client',
                              message: `Permanently delete ${client.full_name}? This cannot be undone.`,
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
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && sortedClients.length > 0 ? (
          <nav className="lw-directory__pagination" aria-label="Client list pages">
            <p className="lw-directory__pagination-meta">
              Showing {rangeStart}–{rangeEnd} of {sortedClients.length}
            </p>
            <div className="lw-directory__pagination-controls">
              <button
                type="button"
                className="lw-directory__page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`lw-directory__page-btn lw-directory__page-btn--num ${pageNum === page ? 'is-active' : ''}`.trim()}
                  aria-current={pageNum === page ? 'page' : undefined}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                className="lw-directory__page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
      </div>

      <ClientFormModal
        open={formOpen}
        mode={formMode}
        client={selected}
        accessToken={accessToken}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ClientConfirmDialog
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
        <div className={`cli-toast cli-toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default ClientListPage;
