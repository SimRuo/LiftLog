import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, Link, Stack } from '@mui/material';
import { FitnessCenterRounded } from '@mui/icons-material';
import { authApi } from '../api/auth';
import { useAuth } from '../context/auth-context';
import { Label } from '../components/ui/Bits';
import GoogleSignIn from '../components/auth/GoogleSignIn';
import { ink } from '../theme';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(username.trim(), password);
      login(res.token, res.username);
      navigate('/plan/edit', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Someone who already has a Google-linked account and taps this by mistake
  // gets signed in rather than an error — the button does both jobs, so the
  // only thing worth branching on is where they land.
  const handleGoogle = (token, username, isNew) => {
    login(token, username);
    navigate(isNew ? '/plan/edit' : '/workouts', { replace: true });
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
        <Label sx={{ mt: 0.5 }}>Create an account</Label>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <GoogleSignIn onSuccess={handleGoogle} onError={setError} label="Continue with Google" />

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
            inputProps={{ minLength: 3, maxLength: 30 }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            inputProps={{ minLength: 6 }}
            helperText="At least 6 characters, with a digit, an uppercase and a symbol."
          />
          <TextField
            fullWidth
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? "These don't match." : ' '}
          />
          <Button fullWidth variant="contained" type="submit" size="large" disabled={loading || mismatch}>
            {loading ? 'Creating account…' : 'Register'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${ink.line}` }}>
        <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" sx={{ color: 'primary.main', fontWeight: 700 }}>
            Sign in
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
