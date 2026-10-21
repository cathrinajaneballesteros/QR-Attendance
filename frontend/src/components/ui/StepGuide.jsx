import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import Card from './Card';

export default function StepGuide({
  title = 'Quick Guide',
  description = 'Follow these 3 simple steps to record attendance.',
  steps = [
    'Open scanner',
    'Scan learner QR',
    'Confirm attendance'
  ],
  className = '',
  style = {}
}) {
  return (
    <Card className={`sres-step-guide ${className}`} style={style} padding="16px 24px">
      {/* Left: Lightbulb & Intro Text */}
      <div className="sres-step-guide-intro">
        <div className="sres-step-guide-icon">
          <Lightbulb size={20} strokeWidth={1.8} color="#6B0F3A" />
        </div>
        <div>
          <h2 className="sres-step-guide-title">{title}</h2>
          <p className="sres-step-guide-desc">{description}</p>
        </div>
      </div>

      {/* Right: Steps with Numbered Maroon Circles & Arrows */}
      <div className="sres-step-guide-flow">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <div className="sres-step-item">
              <span className="sres-step-number">{index + 1}</span>
              <span className="sres-step-label">{step}</span>
            </div>

            {index < steps.length - 1 && (
              <div className="sres-step-arrow">
                <ArrowRight size={15} strokeWidth={1.8} color="#CBD5E1" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}
