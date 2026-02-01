import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Box, CircularProgress, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Button, Dialog, DialogTitle, DialogActions
} from '@mui/material';
import { DeleteRounded, ArrowBackRounded } from '@mui/icons-material';
import { workoutsApi } from '../api/workouts';

export default function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    workoutsApi.get(id).then(setWorkout).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    await workoutsApi.delete(id);
    navigate('/workouts');
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (!workout) return <Typography>Workout not found</Typography>;

  const date = new Date(workout.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const grouped = workout.sets.reduce((acc, set) => {
    const key = set.exerciseName;
    if (!acc[key]) acc[key] = { category: set.exerciseCategory, sets: [] };
    acc[key].sets.push(set);
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton onClick={() => navigate('/workouts')}><ArrowBackRounded /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>{date}</Typography>
          {workout.notes && <Typography color="text.secondary">{workout.notes}</Typography>}
        </Box>
        <IconButton color="error" onClick={() => setDeleteOpen(true)}>
          <DeleteRounded />
        </IconButton>
      </Box>

      {Object.entries(grouped).map(([name, { category, sets }]) => (
        <Card key={name} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>{name}</Typography>
            <Typography variant="caption" color="text.secondary">{category}</Typography>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Set</TableCell>
                  <TableCell align="right">Weight</TableCell>
                  <TableCell align="right">Reps</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sets.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.setNumber}</TableCell>
                    <TableCell align="right">{s.weight}</TableCell>
                    <TableCell align="right">{s.reps}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete this workout?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
