import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy route — booking is a modal on My Consultations.
 * Kept so old links still open the modal.
 */
function BookConsultationPage() {
  return <Navigate to="/dashboard/client/consultations?book=1" replace />;
}

export default BookConsultationPage;
