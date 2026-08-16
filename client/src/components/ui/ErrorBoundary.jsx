import { Component } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Label } from './Bits';

/**
 * A render error used to blank the screen to white with no way back. Now it
 * keeps the app's skin, says what happened, and offers the two things that
 * actually help: reload, or go home.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[LiftLog] render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ p: 3, pt: 8, textAlign: 'center' }}>
        <Label sx={{ color: 'primary.main' }}>Something broke</Label>
        <Typography variant="h5" sx={{ mt: 1, mb: 1 }}>
          This screen crashed
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1, fontSize: '0.9rem' }}>
          Any workout in progress is still saved on this device.
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', mb: 3, fontFamily: 'monospace', wordBreak: 'break-word' }}
        >
          {this.state.error.message}
        </Typography>
        <Button variant="contained" onClick={() => window.location.assign('/')}>
          Reload
        </Button>
      </Box>
    );
  }
}
