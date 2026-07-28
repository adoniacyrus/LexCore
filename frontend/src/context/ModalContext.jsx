import React, { createContext, useState, useContext, useCallback } from 'react';

const ModalContext = createContext(undefined);

function scrollToContact() {
  const element = document.getElementById('contact');
  if (element) {
    const top = element.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

export function ModalProvider({ children }) {
  const [isPortalOpen, setIsPortalOpen] = useState(false);

  const openPortal = () => setIsPortalOpen(true);
  const closePortal = () => setIsPortalOpen(false);
  const openConsultation = useCallback(() => scrollToContact(), []);

  return (
    <ModalContext.Provider
      value={{
        isPortalOpen,
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
