import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkoutHistoryPage from './pages/WorkoutHistoryPage';
import LogWorkoutPage from './pages/LogWorkoutPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import PlanPage from './pages/PlanPage';
import PlanEditPage from './pages/PlanEditPage';
import ProgressPage from './pages/ProgressPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <ProtectedRoute><AppLayout /></ProtectedRoute>
            }>
              <Route index element={<Navigate to="/workouts" replace />} />
              <Route path="workouts" element={<WorkoutHistoryPage />} />
              <Route path="workouts/log" element={<LogWorkoutPage />} />
              <Route path="workouts/:id" element={<WorkoutDetailPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="plan/edit" element={<PlanEditPage />} />
              <Route path="progress" element={<ProgressPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
