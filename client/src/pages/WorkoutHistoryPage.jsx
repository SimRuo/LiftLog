import { useState, useEffect } from 'react';
import { Typography, Box, CircularProgress, Button } from '@mui/material';
import WorkoutCard from '../components/workout/WorkoutCard';
import { workoutsApi } from '../api/workouts';

export default function WorkoutHistoryPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workoutsApi.list(page).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [page]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  const workouts = data?.items || [];
  const totalPages = Math.ceil((data?.totalCount || 0) / (data?.pageSize || 20));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Workout History</Typography>
      {workouts.length === 0 ? (
        <Typography color="text.secondary">No workouts yet. Tap "New" to log your first workout.</Typography>
      ) : (
        <>
          {workouts.map(w => <WorkoutCard key={w.id} workout={w} />)}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
              <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Typography sx={{ alignSelf: 'center' }}>{page} / {totalPages}</Typography>
              <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
