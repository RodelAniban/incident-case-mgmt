import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CaseDetail } from './pages/CaseDetail';
import { Cases } from './pages/Cases';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import {
  AdminUsersPlaceholder,
  ChatPlaceholder,
  EvidencePlaceholder,
  PirPlaceholder,
  ThreatIntelPlaceholder,
} from './pages/PlaceholderPages';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cases" element={<Cases />} />
                <Route path="/cases/:id" element={<CaseDetail />} />
                <Route path="/evidence" element={<EvidencePlaceholder />} />
                <Route path="/chat" element={<ChatPlaceholder />} />
                <Route path="/pir" element={<PirPlaceholder />} />
                <Route path="/threat-intel" element={<ThreatIntelPlaceholder />} />
                <Route path="/admin/users" element={<AdminUsersPlaceholder />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
