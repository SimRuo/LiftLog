import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea, Box, Typography, Stack } from '@mui/material';
import { HotelRounded } from '@mui/icons-material';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';
import { relativeDay, volumeLabel } from '../../lib/format';

export default function WorkoutCard({ workout }) {
  const navigate = useNavigate();

  return (
    <Card sx={{ mb: 1 }}>
      <CardActionArea onClick={() => navigate(`/workouts/${workout.id}`)} sx={{ borderRadius: 0 }}>
        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
              {workout.planDayName || (workout.isRestDay ? 'Rest' : 'Workout')}
            </Typography>
            <Label sx={{ whiteSpace: 'nowrap' }}>{relativeDay(workout.date)}</Label>
          </Stack>

          {workout.isRestDay ? (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, color: 'text.secondary' }}>
              <HotelRounded sx={{ fontSize: 14 }} />
              <Label>Rest day</Label>
            </Stack>
          ) : (
            <>
              {/* The exercise names are the point of a history card — "3
                  exercises, 9 sets" tells you nothing you'd search for. */}
              {workout.exerciseNames && (
                <Typography
                  sx={{
                    mt: 0.4,
                    fontSize: '0.82rem',
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {workout.exerciseNames}
                </Typography>
              )}
              <Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
                <Label>{workout.setCount} sets</Label>
                <Label>{workout.exerciseCount} lifts</Label>
                {workout.volume > 0 && (
                  <Label sx={{ color: 'primary.main' }}>{volumeLabel(Number(workout.volume))}</Label>
                )}
              </Stack>
            </>
          )}

          {workout.notes && (
            <Typography
              sx={{
                mt: 0.75,
                pl: 1,
                borderLeft: `2px solid ${ink.line}`,
                fontSize: '0.8rem',
                color: 'text.secondary',
              }}
            >
              {workout.notes}
            </Typography>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}
