import { useEffect, useState } from 'react';
import { Box, TextField, Button, Stack, Skeleton } from '@mui/material';
import { authApi } from '../../api/auth';
import { SectionHeader } from '../ui/Bits';

/**
 * Account-page widget: set a password on an account that has none (typically
 * Google-only), or change an existing one. Same form either way — the only
 * difference is whether a "current password" field is asked for, since the
 * server itself branches on that.
 *
 * `onChanged` fires after a successful set/change, so the account page can
 * nudge GoogleConnect to refetch — that's what flips "can disconnect Google"
 * from false to true.
 */
export default function PasswordSection({ onChanged, onError, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await authApi.passwordStatus();
        if (!cancelled) setHasPassword(!!s?.hasPassword);
      } catch (err) {
        if (!cancelled) onError?.(err.message || 'Could not load password status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mismatch) return;

    setSubmitting(true);
    try {
      await authApi.setPassword(hasPassword ? currentPassword : undefined, newPassword);
      onSuccess?.(hasPassword ? 'Password changed.' : 'Password set.');
      setHasPassword(true);
      reset();
      onChanged?.();
    } catch (err) {
      onError?.(err.message || 'Could not save that password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Skeleton variant="rectangular" height={64} />;

  return (
    <Box>
      <SectionHeader>Password</SectionHeader>

      {!hasPassword && (
        <Box sx={{ mb: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
          This account signs in with Google only. Set a password to also be able to sign in
          without it, and to be able to disconnect Google later.
        </Box>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {hasPassword && (
            <TextField
              fullWidth
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          )}
          <TextField
            fullWidth
            label={hasPassword ? 'New password' : 'Password'}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            inputProps={{ minLength: 6 }}
            helperText="At least 6 characters."
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
          <Button
            variant="outlined"
            type="submit"
            disabled={submitting || mismatch}
            sx={{ alignSelf: 'flex-start' }}
          >
            {submitting ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
