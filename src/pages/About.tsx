import React from 'react';
import { Info } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-border-ink p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-border-ink pb-4">
          <div className="p-3 bg-light-blue rounded-xl text-accent-blue">
            <Info className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary uppercase tracking-tight">About Tulane Market</h1>
        </div>
        
        <div className="space-y-6 text-text-secondary leading-relaxed">
          <p>
            Welcome to <strong>Tulane Market</strong>, the premier marketplace built exclusively for verified Tulane University students.
          </p>
          <p>
            Whether you're trying to pass down textbooks from last semester, selling dorm furniture before moving out, or looking for game day apparel, Tulane Market provides a safe, scam-free environment to connect directly with your peers.
          </p>
          <h2 className="text-xl font-bold text-text-primary mt-8 mb-4">Why Tulane Market?</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Exclusive Access:</strong> Access is strictly limited to users with a valid <code className="bg-bg-muted px-2 py-1 rounded-md text-sm text-tulane-green border border-border-ink">@tulane.edu</code> email address.</li>
            <li><strong>Campus Focused:</strong> Find items right here in Uptown New Orleans without dealing with shipping or sketchy meetups.</li>
            <li><strong>Peer Rated:</strong> Our rating and review system ensures accountability and builds trust within the campus community.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
