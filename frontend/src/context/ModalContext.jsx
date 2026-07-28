import React, { createContext, useContext, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ModalContext = createContext(undefined);

function scrollToContact() {
  const element = document.getElementById('contact');
  if (element) {
    const top = element.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

export function ModalProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const openPortal = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const closePortal = useCallback(() => {}, []);

  const openConsultation = useCallback(() => {
    if (isAuthenticated) {
      if (location.pathname === '/') {
        scrollToContact();
      } else {
        navigate({ pathname: '/', hash: 'contact' });
      }
      return;
    }
    navigate('/login?intent=consultation');
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <ModalContext.Provider
      value={{
        isPortalOpen: false,
        openPortal,
        closePortal,
        openConsultation,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
}
