import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { DashboardsPage } from './pages/DashboardsPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboards"
          element={
            <ProtectedRoute>
              <DashboardsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboards" replace />} />
        <Route path="*" element={<Navigate to="/dashboards" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
