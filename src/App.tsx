/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { CreateListing } from './pages/CreateListing';
import { ListingDetail } from './pages/ListingDetail';
import { Messages } from './pages/Messages';
import { Profile } from './pages/Profile';

import { Favorites } from './pages/Favorites';
import { Offers } from './pages/Offers';
import { PublicProfile } from './pages/PublicProfile';
import { About } from './pages/About';
import { Safety } from './pages/Safety';
import { Terms } from './pages/Terms';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateListing />} />
              <Route path="/edit/:id" element={<CreateListing />} />
              <Route path="/listing/:id" element={<ListingDetail />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:chatId" element={<Messages />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/user/:id" element={<PublicProfile />} />
              <Route path="/about" element={<About />} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/terms" element={<Terms />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
