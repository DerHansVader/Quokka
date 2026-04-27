import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TeamsPage } from './pages/TeamsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RunsPage } from './pages/RunsPage';
import { RunViewerPage } from './pages/RunViewerPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeamAdminPage } from './pages/TeamAdminPage';
import { AdminPage } from './pages/AdminPage';
import { DocsPage } from './pages/DocsPage';
import { SamplePeek } from './components/SamplePeek';

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/" element={<Protected><TeamsPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/:teamSlug" element={<Protected><ProjectsPage /></Protected>} />
        <Route path="/:teamSlug/team" element={<Protected><TeamAdminPage /></Protected>} />
        <Route path="/:teamSlug/:projectSlug" element={<Protected><RunsPage /></Protected>} />
        <Route path="/:teamSlug/:projectSlug/runs/:runId" element={<Protected><RunViewerPage /></Protected>} />
      </Routes>
      <SamplePeek />
    </Layout>
  );
}
