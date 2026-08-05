import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getClient, getErrorMessage } from '../../services/clientService';
import './clients.css';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ClientDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getClient(accessToken, id);
      setClient(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load client details.'));
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = client
    ? [
        { label: 'Client ID', value: client.client_id },
        { label: 'Full Name', value: client.full_name },
        { label: 'Email', value: client.email },
        { label: 'Phone', value: client.phone_number || '—' },
        { label: 'Role', value: client.role_label || 'Client' },
        {
          label: 'Registration Method',
          value:
            client.registration_method_label ||
            (client.registration_method === 'ADMIN'
              ? 'Admin Registered'
              : 'Self Registered'),
        },
        {
          label: 'Account Status',
          value: client.is_active ? 'Active' : 'Inactive',
        },
        { label: 'Created Date', value: formatDate(client.created_at) },
        { label: 'Last Login', value: formatDateTime(client.last_login) },
      ]
    : [];

  return (
    <DashboardLayout showContext={false} activeModule="clients">
      <div className="cli-detail lw-fade-in">
        <PageHeader
          eyebrow="Client Management"
          title={client?.full_name || 'Client Details'}
          description="Read-only profile for this LexCore client account."
          actions={
            <Link to="/dashboard/admin/clients" className="btn btn-ghost-dark">
              Back to Clients
            </Link>
          }
        />

        {loading ? <p className="lw-muted">Loading client details…</p> : null}
        {error ? (
          <p className="cli-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && client ? (
          <section className="cli-detail__panel" aria-label="Client details">
            <div className="cli-detail__grid">
              {fields.map((field) => (
                <article key={field.label} className="cli-detail__card">
                  <p className="cli-detail__label">{field.label}</p>
                  <p className="cli-detail__value">{field.value}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default ClientDetailPage;
