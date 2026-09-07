import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

/**
 * Dynamically loads the official Razorpay Standard Checkout script.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Verifies Razorpay checkout payment signature server-side.
 */
export async function verifyPayment(access, payload) {
  const { data } = await api.post('/payments/verify/', payload, authHeaders(access));
  return data;
}

/**
 * Creates a fresh payment order for an existing unpaid consultation (retry flow).
 */
export async function retryConsultationPayment(access, consultationId) {
  const { data } = await api.post(
    '/payments/retry/',
    { consultation_id: consultationId },
    authHeaders(access)
  );
  return data;
}

/**
 * Retrieves payment history for a consultation.
 */
export async function getConsultationPayment(access, consultationId) {
  const { data } = await api.get(`/payments/${consultationId}/`, authHeaders(access));
  return data;
}

export { getErrorMessage };
