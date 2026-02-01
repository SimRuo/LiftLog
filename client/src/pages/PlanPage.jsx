import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, CircularProgress, Card, CardContent,
  Button, Chip, Stack, List, ListItem, ListItemText, Divider,
  Dialog, DialogTitle, DialogActions
} from '@mui/material';
import { EditRounded, DeleteRounded, AddRounded } from '@mui/icons-material';
import { plansApi } from '../api/plans';

export default function PlanPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    plansApi.get()
      .then(setPlan)
      .catch(err => {
        if (err.message.includes('404') || err.message.includes('Not Found')) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    await plansApi.delete();
    setPlan(null);
    setNotFound(true);
    setDeleteOpen(false);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  if (notFound || !plan) {
    return (
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>No Plan Yet</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Create a workout plan to get started with structured training.
        </Typography>
        <Button variant="contained" startIcon={<AddRounded />}
          onClick={() => navigate('/plan/edit')}>
          Create Plan
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{plan.name}</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<EditRounded />}
            onClick={() => navigate('/plan/edit')}>Edit</Button>
          <Button size="small" color="error" startIcon={<DeleteRounded />}
            onClick={() => setDeleteOpen(true)}>Delete</Button>
        </Stack>
      </Box>

      {plan.days.map(day => (
        <Card key={day.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip label={`Day ${day.order + 1}`} size="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>{day.name}</Typography>
            </Box>
            <List dense disablePadding>
              {day.exercises.map((ex, idx) => (
                <Box key={ex.id}>
                  {idx > 0 && <Divider />}
                  <ListItem disableGutters>
                    <ListItemText
                      primary={ex.exerciseName}
                      secondary={`${ex.sets} x ${ex.reps}${ex.weight > 0 ? ` @ ${ex.weight} kg` : ''}${ex.notes ? ` — ${ex.notes}` : ''}`}
                    />
                    <Chip label={ex.exerciseCategory} size="small" variant="outlined" />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      ))}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete this workout plan?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
