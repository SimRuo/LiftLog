import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography, Skeleton } from "@mui/material";
import { CheckCircleRounded } from "@mui/icons-material";
import { authApi } from "../../api/auth";
import { createCodeClient } from "../../auth/google";
import { GoogleMark } from "./GoogleSignIn";
import { Label, SectionHeader } from "../ui/Bits";
import { ink } from "../../theme";

/**
 * Account-page widget: connect or disconnect Google for the *already signed
 * in* user. Distinct from GoogleSignIn — that one authenticates you; this one
 * only ever links or unlinks, and never touches the session.
 *
 * Renders nothing once loaded if the server has no Google credentials
 * configured at all, same as the login screen.
 *
 * `refreshSignal` — bump it (e.g. a counter) to make this refetch its status
 * without remounting. The account page uses that after a password change,
 * since setting a password is what flips `canUnlink` from false to true.
 */
export default function GoogleConnect({ onError, refreshSignal }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState(null); // { linked, email, canUnlink }
  const [busy, setBusy] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const clientRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refreshStatus = async () => {
    const s = await authApi.googleStatus();
    if (alive.current) setStatus(s);
    return s;
  };

  useEffect(() => {
    (async () => {
      let cfg;
      try {
        [cfg] = await Promise.all([authApi.googleConfig(), refreshStatus()]);
      } catch (err) {
        if (alive.current) onError?.(err.message || "Could not load Google connection status.");
        return;
      } finally {
        if (alive.current) setLoading(false);
      }
      if (!alive.current || !cfg?.enabled || !cfg.clientId) return;
      setEnabled(true);

      // Built ahead of time for the same reason as the login button: the
      // popup has to open synchronously inside the click.
      try {
        const client = await createCodeClient({
          clientId: cfg.clientId,
          scope: cfg.scope,
          onCode: async (code) => {
            try {
              await authApi.googleLink(code);
              await refreshStatus();
            } catch (err) {
              if (alive.current) onError?.(err.message || "Could not connect that Google account.");
            } finally {
              if (alive.current) setBusy(false);
            }
          },
          onError: (err) => {
            if (!alive.current) return;
            setBusy(false);
            if (err) onError?.(err.message);
          },
        });
        if (!alive.current) return;
        clientRef.current = client;
        setClientReady(true);
      } catch (err) {
        if (alive.current) onError?.(err.message);
      }
    })();
    // Mount-only, same reasoning as GoogleSignIn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip the first run — the effect above already fetched the initial status,
  // and re-fetching here too would just be a redundant request on mount.
  const firstRefresh = useRef(true);
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    if (refreshSignal !== undefined) refreshStatus();
  }, [refreshSignal]);

  const handleUnlink = async () => {
    setBusy(true);
    try {
      await authApi.googleUnlink();
      await refreshStatus();
    } catch (err) {
      onError?.(err.message || "Could not disconnect Google.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (loading) return <Skeleton variant="rectangular" height={64} />;
  if (!enabled) return null; // Server has no Google credentials configured.

  return (
    <Box>
      <SectionHeader>Connections</SectionHeader>

      {status?.linked ? (
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CheckCircleRounded sx={{ color: "success.main", fontSize: 20 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>Google connected</Typography>
            {status.email && <Label>{status.email}</Label>}
          </Box>
          <Button size="small" disabled={busy || !status.canUnlink} onClick={handleUnlink} sx={{ color: "text.secondary" }}>
            Disconnect
          </Button>
        </Stack>
      ) : (
        <Button
          fullWidth
          size="large"
          variant="outlined"
          disabled={busy || !clientReady}
          onClick={() => {
            setBusy(true);
            clientRef.current?.requestCode();
          }}
          startIcon={<GoogleMark />}
          sx={{
            color: ink.text,
            borderColor: ink.lineBright,
            "&:hover": { borderColor: ink.text, bgcolor: ink.raised },
          }}
        >
          {busy ? "Waiting for Google…" : "Connect Google account"}
        </Button>
      )}

      {status?.linked && !status.canUnlink && (
        <Typography sx={{ mt: 1, fontSize: "0.78rem", color: "text.secondary" }}>
          Set a password to be able to disconnect Google — otherwise it's the only way into this account.
        </Typography>
      )}
    </Box>
  );
}
