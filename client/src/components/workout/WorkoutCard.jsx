import { useNavigate } from 'react-router-dom';
import {
  Card, CardActionArea, CardContent, Typography, Chip, Stack
} from '@mui/material';
import { CalendarTodayRounded, HotelRounded } from '@mui/icons-material';

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
              {workout.isRestDay ? (
                <HotelRounded fontSize="small" color="secondary" />
              ) : (
                <CalendarTodayRounded fontSize="small" color="primary" />
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                {workout.planDayName ? `${workout.planDayName} — ${date}` : date}
              </Typography>
            </Stack>
            {workout.isRestDay ? (
              <Chip label="Rest Day" size="small" color="secondary" variant="outlined" />
            ) : (
              <Stack direction="row" spacing={1}>
                <Chip label={`${workout.exerciseCount} exercises`} size="small" />
                <Chip label={`${workout.setCount} sets`} size="small" variant="outlined" />
              </Stack>
            )}
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
