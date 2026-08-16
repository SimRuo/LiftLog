import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Skeleton } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { RestTimerProvider } from './context/RestTimerContext';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import PublicOnlyRoute from './components/layout/PublicOnlyRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkoutHistoryPage from './pages/WorkoutHistoryPage';
import LogWorkoutPage from './pages/LogWorkoutPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import PlanPage from './pages/PlanPage';
import PlanEditPage from './pages/PlanEditPage';

// The charting library is by far the largest dependency in the bundle and is
// only needed on one tab. Splitting it keeps the first load — the one that
// happens on gym wifi before you can log anything — small.
const ProgressPage = lazy(() => import('./pages/ProgressPage'));

function RouteFallback() {
  return (
    <Box>
      <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={280} />
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <RestTimerProvider>
              <BrowserRouter>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <PublicOnlyRoute>
                        <LoginPage />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicOnlyRoute>
                        <RegisterPage />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/workouts" replace />} />
                    <Route path="workouts" element={<WorkoutHistoryPage />} />
                    <Route path="workouts/log" element={<LogWorkoutPage />} />
                    <Route path="workouts/:id" element={<WorkoutDetailPage />} />
                    <Route path="plan" element={<PlanPage />} />
                    <Route path="plan/edit" element={<PlanEditPage />} />
                    <Route
                      path="progress"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <ProgressPage />
                        </Suspense>
                      }
                    />
                  </Route>
                  <Route path="*" element={<Navigate to="/workouts" replace />} />
                </Routes>
              </BrowserRouter>
            </RestTimerProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
