import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@/App.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { BranchProvider } from '@/contexts/BranchContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import CustomersPage from '@/pages/Customers';
import RepairsPage from '@/pages/Repairs';
import RepairNew from '@/pages/RepairNew';
import RepairDetail from '@/pages/RepairDetail';
import InvoicePage from '@/pages/Invoice';
import PublicStatusPage from '@/pages/PublicStatus';
import SparePartsPage from '@/pages/SpareParts';
import UsersPage from '@/pages/Users';
import BranchesPage from '@/pages/Branches';
import SettingsPage from '@/pages/Settings';
import ReportsPage from '@/pages/Reports';
import ReviewsPage from '@/pages/Reviews';
import ProfilePage from '@/pages/Profile';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BranchProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Public status page - no auth required */}
            <Route path="/status/:ticket_no" element={<PublicStatusPage />} />

            {/* Invoice - outside layout so it prints clean */}
            <Route path="/repairs/:id/invoice" element={
              <ProtectedRoute><InvoicePage /></ProtectedRoute>
            } />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/repairs" element={<RepairsPage />} />
              <Route path="/repairs/new" element={
                <ProtectedRoute roles={['admin', 'cashier', 'technician']}><RepairNew /></ProtectedRoute>
              } />
              <Route path="/repairs/:id" element={<RepairDetail />} />

              <Route path="/customers" element={
                <ProtectedRoute roles={['admin', 'cashier', 'technician']}><CustomersPage /></ProtectedRoute>
              } />

              <Route path="/spareparts" element={
                <ProtectedRoute roles={['admin', 'technician']}><SparePartsPage /></ProtectedRoute>
              } />

              <Route path="/reports" element={
                <ProtectedRoute roles={['admin']}><ReportsPage /></ProtectedRoute>
              } />

              <Route path="/reviews" element={
                <ProtectedRoute roles={['admin', 'cashier']}><ReviewsPage /></ProtectedRoute>
              } />

              <Route path="/profile" element={
                <ProtectedRoute roles={['admin', 'technician', 'cashier']}><ProfilePage /></ProtectedRoute>
              } />

              <Route path="/users" element={
                <ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>
              } />

              <Route path="/branches" element={
                <ProtectedRoute roles={['admin']}><BranchesPage /></ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors closeButton />
        </BranchProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
