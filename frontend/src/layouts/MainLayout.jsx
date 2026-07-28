import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const SECTION_IDS = new Set(['home', 'practices', 'about', 'contact']);

function scrollToHash(hash) {
  const id = hash?.replace(/^#/, '');
  if (!id || !SECTION_IDS.has(id)) return;

  if (id === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const element = document.getElementById(id);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior: 'smooth' });
}

function MainLayout() {
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (location.hash) {
        scrollToHash(location.hash);
      } else if (location.pathname === '/') {
        // arriving from another route without hash — stay at top unless already scrolled
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
