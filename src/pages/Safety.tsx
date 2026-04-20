import React from 'react';
import { animate, motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

export const Safety: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-border-ink p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-border-ink pb-4">
          <div className="p-3 bg-green-50 rounded-xl text-tulane-green">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary uppercase tracking-tight">Safety Guidelines</h1>
        </div>
        
        <div className="space-y-6 text-text-secondary leading-relaxed">
          <p>
            Your safety is our top priority. While Tulane Market is restricted to verified students, we strongly encourage everyone to use common sense and follow best practices when buying and selling on campus.
          </p>
          
          <div className="bg-bg-muted p-5 rounded-xl border border-border-ink mt-6">
            <h3 className="font-bold text-lg text-text-primary mb-3">Meeting Up</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Always meet in well-lit, public locations on campus (e.g., Lavin-Bernick Center, Howard-Tilton Memorial Library, or Reily Center).</li>
              <li>Avoid meeting in secluded areas or going to a stranger's dorm room alone.</li>
              <li>Bring a friend with you if you feel uncomfortable.</li>
            </ul>
          </div>

          <div className="bg-bg-muted p-5 rounded-xl border border-border-ink">
            <h3 className="font-bold text-lg text-text-primary mb-3">Transactions</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Inspect the item carefully before transferring any money.</li>
              <li>Use secure peer-to-peer payment methods like Venmo, Zelle, or CashApp securely in-person.</li>
              <li>Be cautious of users trying to orchestrate complex shipping or third-party payment schemes.</li>
            </ul>
          </div>
          
          <p className="pt-4 border-t border-border-ink">
            If you encounter suspicious behavior or feel unsafe, please report the user and contact TUPD at <strong className="text-text-primary font-bold">(504) 865-5911</strong> for emergencies.
          </p>
        </div>
      </div>
    </div>
  );
};
