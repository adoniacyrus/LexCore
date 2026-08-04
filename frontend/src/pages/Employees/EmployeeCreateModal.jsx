/**
 * Backward-compatible create wrapper around EmployeeFormModal.
 */
import React from 'react';
import EmployeeFormModal from './EmployeeFormModal';

function EmployeeCreateModal({ open, accessToken, onClose, onCreated }) {
  return (
    <EmployeeFormModal
      open={open}
      mode="create"
      accessToken={accessToken}
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}

export default EmployeeCreateModal;
