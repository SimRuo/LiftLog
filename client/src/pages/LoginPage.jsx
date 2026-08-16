import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, Link, Stack } from '@mui/material';
import { FitnessCenterRounded } from '@mui/icons-material';
import { authApi } from '../api/auth';
import { useAuth } from '../context/auth-context';
import { Label } from '../components/ui/Bits';
import { ink } from '../theme';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, expiredNotice, clearExpiredNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where ProtectedRoute bounced them from, so signing in resumes the journey.
  const from = location.state?.from?.pathname || '/workouts';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    clearExpiredNotice();
    setLoading(true);
    try {
      const res = await authApi.login(username.trim(), password);
      login(res.token, res.username);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        p: 3,
        maxWidth: 420,
        mx: 'auto',
      }}
    >
      <Box sx={{ mb: 4 }}>
        <FitnessCenterRounded sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h2" sx={{ fontSize: '2.75rem', mt: 1 }}>
          LiftLog
        </Typography>
        <Label sx={{ mt: 0.5 }}>Sign in to continue</Label>
      </Box>

      {expiredNotice && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your session expired. Sign in again — nothing you logged was lost.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button fullWidth variant="contained" type="submit" size="large" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${ink.line}` }}>
        <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
          No account?{' '}
          <Link component={RouterLink} to="/register" sx={{ color: 'primary.main', fontWeight: 700 }}>
            Register
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
