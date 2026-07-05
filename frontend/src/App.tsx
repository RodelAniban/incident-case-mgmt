import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccountSecurity } from './pages/AccountSecurity';
import { CaseDetail } from './pages/CaseDetail';
import { Cases } from './pages/Cases';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ThreatIntel } from './pages/ThreatIntel';
import { UserAdministration } from './pages/UserAdministration';

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
                <Route path="/threat-intel" element={<ThreatIntel />} />
                <Route path="/admin/users" element={<UserAdministration />} />
                <Route path="/account/security" element={<AccountSecurity />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
