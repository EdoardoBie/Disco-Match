import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Dashboard from '@/pages/Dashboard';
import Admin from '@/pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admin" element={<Admin />} />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
