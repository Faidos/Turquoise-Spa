import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import { LogOut, LayoutDashboard, Database, Users } from 'lucide-react';

const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

const Navbar = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="glass" style={{ margin: '20px', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--primary)', letterSpacing: '1px' }}>
        TURQUOISE SPA
      </div>
      <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <LayoutDashboard size={18} /> Dashboard
        </Link>
        {user.role === 'admin' && (
          <>
            <Link to="/admin/services" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Database size={18} /> Services
            </Link>
            <Link to="/admin/users" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Users size={18} /> Agents
            </Link>
          </>
        )}
        <button onClick={logout} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '6px 12px', fontSize: '0.8rem' }}>
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </nav>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main className="container" style={{ flex: 1 }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <PrivateRoute>
                  <DashboardRouter />
                </PrivateRoute>
              } />
              {/* Simple catch-all for now */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          <footer style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            &copy; 2026 Turquoise Spa Management System. Premium Interface.
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
};

const DashboardRouter = () => {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminDashboard /> : <AgentDashboard />;
};

export default App;
