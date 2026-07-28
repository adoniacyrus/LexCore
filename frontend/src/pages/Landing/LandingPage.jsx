import React from 'react';
import Hero from '../../components/Hero';
import PracticeAreas from '../../components/PracticeAreas';
import WhyChooseUs from '../../components/WhyChooseUs';
import WorkingWithYou from '../../components/WorkingWithYou';

function LandingPage() {
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
