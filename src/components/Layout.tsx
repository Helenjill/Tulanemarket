import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg-page">
      <Navbar />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="bg-bg-muted border-t border-border-ink py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-text-secondary font-medium uppercase tracking-wider text-[11px]">© 2026 Tulane Market. For Tulane students only.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link to="/about" className="text-[11px] text-text-secondary hover:text-accent-blue font-bold uppercase tracking-wider transition-colors">About</Link>
            <Link to="/safety" className="text-[11px] text-text-secondary hover:text-accent-blue font-bold uppercase tracking-wider transition-colors">Safety</Link>
            <Link to="/terms" className="text-[11px] text-text-secondary hover:text-accent-blue font-bold uppercase tracking-wider transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
