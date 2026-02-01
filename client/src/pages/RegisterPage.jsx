import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Link
} from '@mui/material';
import { FitnessCenterRounded } from '@mui/icons-material';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(username, password);
      login(res.token, res.username);
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <FitnessCenterRounded sx={{ fontSize: 48, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={700}>LiftLog</Typography>
            <Typography color="text.secondary">Create your account</Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="Username" margin="normal"
              value={username} onChange={e => setUsername(e.target.value)} required
              inputProps={{ minLength: 3, maxLength: 30 }} />
            <TextField fullWidth label="Password" type="password" margin="normal"
              value={password} onChange={e => setPassword(e.target.value)} required
              inputProps={{ minLength: 6 }} />
            <TextField fullWidth label="Confirm Password" type="password" margin="normal"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            <Button fullWidth variant="contained" type="submit" size="large"
              sx={{ mt: 2 }} disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </Button>
          </Box>
          <Typography sx={{ mt: 2, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">Sign in</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
