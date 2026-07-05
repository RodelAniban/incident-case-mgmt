import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { theme } from './theme';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Only pulls in Google's Identity Services script (an intentional exception
// to this app's otherwise no-external-egress stance — SSO inherently needs
// to talk to Google) when a client ID is actually configured.
function withGoogleProvider(children: React.ReactNode) {
  return googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider> : children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <BrowserRouter>
        {withGoogleProvider(
          <AuthProvider>
            <App />
          </AuthProvider>,
        )}
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
