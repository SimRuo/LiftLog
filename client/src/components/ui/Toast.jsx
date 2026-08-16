import { useState, useCallback, useMemo } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { ToastContext } from './toast-context';

/**
 * One place for transient feedback. Before this, every page grew its own
 * `error` state and rendered an inline <Alert>, which meant a failed save
 * pushed the whole form down and a successful one said nothing at all.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, severity = 'info') => {
    setToast({ message, severity, key: Date.now() });
  }, []);

  const value = useMemo(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={!!toast}
        autoHideDuration={toast?.severity === 'error' ? 6000 : 3000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // Clear of the bottom nav, so it never covers the thing you just tapped.
        sx={{ bottom: { xs: 'calc(76px + env(safe-area-inset-bottom)) !important' } }}
      >
        <Alert
          severity={toast?.severity || 'info'}
          variant="outlined"
          onClose={() => setToast(null)}
          sx={{ width: '100%', bgcolor: 'background.paper' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
