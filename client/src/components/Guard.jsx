import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Guard({ children, roles }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="card">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <div className="card">Insufficient permissions.</div>;
  return children;
}
