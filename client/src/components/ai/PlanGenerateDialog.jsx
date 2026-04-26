import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, Typography, Box
} from '@mui/material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { aiApi } from '../../api/ai';

export default function PlanGenerateDialog({ open, onClose, onGenerate }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setError('');
    setLoading(true);
    try {
      const plan = await aiApi.generatePlan(description.trim());
      onGenerate(plan);
      setDescription('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRounded color="primary" />
        Generate Plan with AI
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Describe what you want — the AI will build a full plan using your available exercises.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="What kind of plan do you want?"
          placeholder={'e.g. "3-day push/pull/legs for intermediate, hypertrophy focus"\n"5-day upper/lower split, 4 sets of 6 reps, strength focus"\n"Full body 3x per week for a beginner"'}
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
          autoFocus
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Generating your plan…</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          startIcon={<AutoAwesomeRounded />}
        >
          Generate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
