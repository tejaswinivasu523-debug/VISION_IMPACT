import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { RealtimeProvider } from './lib/realtime';
import { SettingsProvider } from './lib/settings';
import { LiveScanProvider } from './lib/live';
import { FloatingDock, Footer, Navbar, TabBar } from './components/Chrome';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const LiveScan = React.lazy(() => import('./pages/LiveScan'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const RoutesPage = React.lazy(() => import('./pages/RoutesPage'));
const Report = React.lazy(() => import('./pages/Report'));
const Community = React.lazy(() => import('./pages/Community'));
const Sos = React.lazy(() => import('./pages/Sos'));
const Indoor = React.lazy(() => import('./pages/Indoor'));
const Crossing = React.lazy(() => import('./pages/Crossing'));
const Journey = React.lazy(() => import('./pages/Journey'));
const Guardian = React.lazy(() => import('./pages/Guardian'));
const Settings = React.lazy(() => import('./pages/SettingsPage'));
const About = React.lazy(() => import('./pages/About'));

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const shortcuts = {
      1: '/', 2: '/scan', 3: '/alerts', 4: '/routes', 5: '/community',
      6: '/sos', 7: '/journey', 8: '/settings',
    };
    const onKey = (event) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const target = shortcuts[event.key];
      if (target) {
        event.preventDefault();
        navigate(target);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="page">
      <a href="#main" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main" className="shell page-enter" key={location.pathname}>
        <Suspense
          fallback={
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--ink-muted)' }} role="status">
              Loading live workspace…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<LiveScan />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/report" element={<Report />} />
            <Route path="/community" element={<Community />} />
            <Route path="/sos" element={<Sos />} />
            <Route path="/indoor" element={<Indoor />} />
            <Route path="/crossing" element={<Crossing />} />
            <Route path="/journey" element={<Journey />} />
            <Route path="/guardian" element={<Guardian />} />
            <Route path="/guardian/:code" element={<Guardian />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Footer />
      </main>
      <FloatingDock />
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <RealtimeProvider>
          <LiveScanProvider>
            <Shell />
          </LiveScanProvider>
        </RealtimeProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
