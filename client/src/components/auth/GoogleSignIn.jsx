import { useEffect, useRef, useState } from 'react';
import { Button, Box, Divider, Typography } from '@mui/material';
import { authApi } from '../../api/auth';
import { createCodeClient } from '../../auth/google';
import { ink, MONO } from '../../theme';

/** Google's mark, inline. An external image would be one more thing to fail. */
export function GoogleMark() {
  return (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: 18, height: 18, flexShrink: 0 }} aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Box>
  );
}

/**
 * Sign in with Google.
 *
 * Renders nothing at all when the server says the feature isn't configured,
 * rather than showing a button that can only disappoint. That also means a
 * local dev box without credentials sees exactly the old screen.
 *
 * `onSuccess(token, username, isNewAccount)` mirrors what the password form
 * does with its response, so the caller's handling is identical either way.
 */
export default function GoogleSignIn({ onSuccess, onError, label = 'Sign in with Google' }) {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Ask the server whether to offer this, then warm up the code client. The
  // client has to exist before the click: requestCode opens a popup, and a
  // popup opened after an await is no longer attributable to the tap, so the
  // browser blocks it.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let cfg;
      try {
        cfg = await authApi.googleConfig();
      } catch {
        return; // Offline, or an older server. Fall back to the password form.
      }
      if (cancelled || !cfg?.enabled || !cfg.clientId) return;

      try {
        const client = await createCodeClient({
          clientId: cfg.clientId,
          scope: cfg.scope,
          onCode: async (code) => {
            try {
              const res = await authApi.google(code);
              if (alive.current) onSuccess(res.token, res.username, res.isNewAccount);
            } catch (err) {
              if (alive.current) onError?.(err.message || 'Google sign-in failed.');
            } finally {
              if (alive.current) setBusy(false);
            }
          },
          onError: (err) => {
            if (!alive.current) return;
            setBusy(false);
            // A null error is a deliberate cancel — say nothing.
            if (err) onError?.(err.message);
          },
        });
        if (cancelled) return;
        clientRef.current = client;
        setConfig(cfg);
      } catch (err) {
        if (!cancelled) onError?.(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-only: re-running would build a second code client for no gain, and
    // the callbacks close over refs that stay current anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The divider belongs to this block, not to the page: it only means anything
  // when there are in fact two ways to sign in.
  if (!config) return null;

  return (
    <>
      <Button
        fullWidth
        size="large"
        variant="outlined"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          clientRef.current?.requestCode();
        }}
        startIcon={<GoogleMark />}
        sx={{
          color: ink.text,
          borderColor: ink.lineBright,
          '&:hover': { borderColor: ink.text, bgcolor: ink.raised },
        }}
      >
        {busy ? 'Waiting for Google…' : label}
      </Button>

      <Divider sx={{ my: 2.5, '&::before, &::after': { borderColor: ink.line } }}>
        <Typography
          sx={{ fontFamily: MONO, fontSize: '0.7rem', color: ink.dim, letterSpacing: '0.14em' }}
        >
          OR
        </Typography>
      </Divider>
    </>
  );
}
