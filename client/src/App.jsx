import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkoutHistoryPage from './pages/WorkoutHistoryPage';
import NewWorkoutPage from './pages/NewWorkoutPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import ExerciseLibraryPage from './pages/ExerciseLibraryPage';
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
              <Route path="workouts/new" element={<NewWorkoutPage />} />
              <Route path="workouts/:id" element={<WorkoutDetailPage />} />
              <Route path="exercises" element={<ExerciseLibraryPage />} />
              <Route path="progress" element={<ProgressPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
