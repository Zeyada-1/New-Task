import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Component } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UndoProvider } from './context/UndoContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import SearchPage from './pages/Search';
import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import Orbit from './pages/Orbit';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function PrivateLayout({ children }) {
  const { dark } = useTheme();
  return (
    <div className={`min-h-screen transition-colors duration-300 ${dark ? 'bg-[#1c1917]' : 'bg-[#f7f6f3]'}`}>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3]">
      <div className="text-center">
        <p className="text-7xl font-bold text-orange-400 mb-4">404</p>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Page not found</h1>
        <p className="text-stone-500 mb-6">The page you’re looking for doesn’t exist.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-6 py-2.5">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3]">
          <div className="text-center">
            <p className="text-5xl mb-4">🪐</p>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
            <p className="text-stone-500 mb-6">An unexpected error occurred. Try refreshing the page.</p>
            <button onClick={() => window.location.reload()} className="btn-primary px-6 py-2.5">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ThemedToaster() {
  const { dark } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      containerStyle={{ bottom: 88 }}
      toastOptions={{
        style: dark
          ? { background: '#292524', color: '#f5f5f4', border: '1px solid #44403c', borderRadius: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }
          : { background: '#ffffff', color: '#171717', border: '1px solid #e5e3de', borderRadius: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
      }}
    />
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page, #f7f6f3)' }}>
      <div className="text-stone-400 animate-pulse text-xl">Loading...</div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<PrivateRoute><PrivateLayout><Dashboard /></PrivateLayout></PrivateRoute>} />
      <Route path="/tasks" element={<PrivateRoute><PrivateLayout><Tasks /></PrivateLayout></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><PrivateLayout><Calendar /></PrivateLayout></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><PrivateLayout><Analytics /></PrivateLayout></PrivateRoute>} />
      <Route path="/orbit" element={<PrivateRoute><PrivateLayout><Orbit /></PrivateLayout></PrivateRoute>} />
      <Route path="/search" element={<PrivateRoute><PrivateLayout><SearchPage /></PrivateLayout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><PrivateLayout><Settings /></PrivateLayout></PrivateRoute>} />
      <Route path="/users/:username" element={<PrivateRoute><PrivateLayout><UserProfile /></PrivateLayout></PrivateRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <UndoProvider>
            <ThemeProvider>
            <ThemedToaster />
            <AppRoutes />
            </ThemeProvider>
          </UndoProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

