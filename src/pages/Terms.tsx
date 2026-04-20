import React from 'react';
import { ScrollText } from 'lucide-react';

export const Terms: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-border-ink p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-border-ink pb-4">
          <div className="p-3 bg-slate-100 rounded-xl text-text-primary">
            <ScrollText className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary uppercase tracking-tight">Terms of Service</h1>
        </div>
        
        <div className="space-y-6 text-text-secondary leading-relaxed text-sm">
          <p>Last updated: April 2026</p>
          
          <h3 className="font-bold text-lg text-text-primary mt-6">1. Eligibility</h3>
          <p>
            You must be a current student at Tulane University with a valid, active <code className="bg-bg-muted px-2 py-1 rounded-md text-xs border border-border-ink">@tulane.edu</code> email address to register or use the Platform. You may not misrepresent your identity or university affiliation.
          </p>

          <h3 className="font-bold text-lg text-text-primary mt-6">2. Acceptable Use</h3>
          <p>
            You agree not to use the Platform to post, sell, or solicit illegal items, weapons, drugs, stolen goods, or any items that explicitly violate Tulane University's Code of Student Conduct.
          </p>

          <h3 className="font-bold text-lg text-text-primary mt-6">3. User Interactions</h3>
          <p>
            Tulane Market acts strictly as a venue for students to connect. We do not oversee the quality, safety, or legality of items advertised. You agree that Tulane Market and its creators are not responsible or liable for any transactions, interactions, or disputes between users.
          </p>

          <h3 className="font-bold text-lg text-text-primary mt-6">4. Termination</h3>
          <p>
            We reserve the right to suspend or permanently ban any user account that receives repeated negative reviews, posts prohibited items, or violates these Terms or university policies without prior notice.
          </p>
        </div>
      </div>
    </div>
  );
};
