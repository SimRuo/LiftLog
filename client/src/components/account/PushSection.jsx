import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Switch, Typography, Skeleton } from '@mui/material';
import { pushApi } from '../../api/push';
import { pushSupported, pushState, enablePush, disablePush } from '../../lib/push';
import { SectionHeader } from '../ui/Bits';

/**
 * Account-page toggle for workout reminders.
 *
 * Renders nothing when the server has no VAPID keys, same as GoogleConnect —
 * an unconfigured deployment shouldn't offer a switch that can't do anything.
 *
 * The switch is a plain click handler on purpose: both `requestPermission` and
 * `pushManager.subscribe` have to run inside a user gesture, so none of this
 * can move into an effect.
 */
export default function PushSection({ onError, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState(null); // { supported, permission, subscribed }
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [config, current] = await Promise.all([pushApi.config(), pushState()]);
        if (!alive.current) return;
        setEnabled(!!config?.enabled);
        setState(current);
      } catch {
        // A server that can't answer just means no toggle. Not worth a toast on
        // a page the user opened to do something else.
        if (alive.current) setEnabled(false);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = state?.subscribed ? await disablePush() : await enablePush();
      if (!alive.current) return;
      setState(next);
      if (next.subscribed) onSuccess?.('Workout reminders are on for this device.');
    } catch (err) {
      onError?.(err.message || 'Could not change notification settings.');
      // Re-read rather than assume: permission may have been granted even
      // though the subscribe that followed it failed.
      if (alive.current) setState(await pushState());
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      await pushApi.test();
      onSuccess?.('Sent — it should appear in a moment.');
    } catch (err) {
      onError?.(err.message || 'Could not send a test notification.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (loading) return <Skeleton variant="rectangular" height={64} />;
  if (!enabled) return null; // Server has no VAPID keys configured.

  if (!pushSupported()) {
    return (
      <Box>
        <SectionHeader>Reminders</SectionHeader>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
          This browser doesn't support notifications.
        </Typography>
      </Box>
    );
  }

  const blocked = state?.permission === 'denied';

  return (
    <Box>
      <SectionHeader>Reminders</SectionHeader>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Unfinished workout nudge</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            If a workout is still open after 3 hours, remind me to finish it.
          </Typography>
        </Box>
        <Switch
          checked={!!state?.subscribed}
          disabled={busy || blocked}
          onChange={toggle}
          inputProps={{ 'aria-label': 'Unfinished workout reminders' }}
        />
      </Stack>

      {blocked && (
        <Typography sx={{ mt: 1, fontSize: '0.78rem', color: 'text.secondary' }}>
          Notifications are blocked for this site. Turn them back on in your browser's site
          settings, then reload.
        </Typography>
      )}

      {state?.subscribed && (
        <Button size="small" disabled={busy} onClick={sendTest} sx={{ mt: 1, color: 'text.secondary' }}>
          Send a test notification
        </Button>
      )}
    </Box>
  );
}
