import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';

/**
 * Keeps a signed-in user off /login and /register. Without this you can sit on
 * a login form while already authenticated, which is the other half of the
 * "am I logged in or not" confusion.
 */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/workouts" replace />;
  return children;
}
