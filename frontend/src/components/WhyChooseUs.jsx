import React from 'react';
import { useReveal } from '../hooks/useReveal';

const reasons = [
  { num: '01', title: 'Experienced counsel', desc: 'Deep practice knowledge across complex matters.' },
  { num: '02', title: 'Client-first approach', desc: 'Your priorities shape every recommendation.' },
  { num: '03', title: 'Confidential by design', desc: 'Strict discretion at every stage.' },
  { num: '04', title: 'Clear communication', desc: 'Timely updates without the jargon.' },
];

function WhyChooseUs() {
  const labelRef = useReveal();
  const stripRef = useReveal();

  return (
    <section id="about" className="why-band">
      <div className="container-custom why-band-inner">
        <div ref={labelRef} className="why-band-label reveal">
          <span className="section-tag-gold">Why LexCore</span>
          <h2>Dedicated.<br />Clear. Reliable.</h2>
        </div>

        <div ref={stripRef} className="why-strip reveal-stagger">
          {reasons.map((reason) => (
            <div key={reason.title} className="why-item">
              <span className="why-item-num">{reason.num}</span>
              <h4>{reason.title}</h4>
              <p>{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhyChooseUs;
