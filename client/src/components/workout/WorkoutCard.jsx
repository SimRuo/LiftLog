import { useNavigate } from 'react-router-dom';
import {
  Card, CardActionArea, CardContent, Typography, Chip, Stack
} from '@mui/material';
import { CalendarTodayRounded } from '@mui/icons-material';

export default function WorkoutCard({ workout }) {
  const navigate = useNavigate();
  const date = new Date(workout.date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardActionArea onClick={() => navigate(`/workouts/${workout.id}`)}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <CalendarTodayRounded fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>{date}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip label={`${workout.exerciseCount} exercises`} size="small" />
              <Chip label={`${workout.setCount} sets`} size="small" variant="outlined" />
            </Stack>
          </Stack>
          {workout.notes && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {workout.notes}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
