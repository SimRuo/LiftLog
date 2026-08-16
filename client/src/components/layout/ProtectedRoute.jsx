import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Carry where they were headed so signing in returns them there instead of
  // always dumping them on the history page.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
