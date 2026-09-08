import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../../components/Hero';
import PracticeAreas from '../../components/PracticeAreas';
import WhyChooseUs from '../../components/WhyChooseUs';
import WorkingWithYou from '../../components/WorkingWithYou';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../utils/roleRoutes';

function LandingPage() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role) {
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate]);

  return (
    <div className="landing-page">
      <Hero />
      <PracticeAreas />
      <WhyChooseUs />
      <WorkingWithYou />
    </div>
  );
}

export default LandingPage;
