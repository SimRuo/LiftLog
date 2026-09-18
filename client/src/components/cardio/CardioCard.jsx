import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea, Box, Typography, Stack, Chip } from '@mui/material';
import { FavoriteRounded, CloudUploadOutlined } from '@mui/icons-material';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';
import { relativeDay, clock, km, pace, rpeLabel } from '../../lib/format';

/**
 * A cardio session in the history timeline.
 *
 * Deliberately a sibling of WorkoutCard rather than another branch inside it.
 * The two share a silhouette but almost no content — sets and volume against
 * duration and pace — and folding cardio in would have left that component a
 * thicket of `kind ===` checks around every line.
 */
export default function CardioCard({ session }) {
  const navigate = useNavigate();
  const perKm = pace(session.durationSeconds, session.distanceMeters);
  const effort = rpeLabel(session.rpe);

  return (
    <Card sx={{ mb: 1 }}>
      <CardActionArea
        onClick={() => navigate(`/cardio/${session.id}`)}
        sx={{ borderRadius: 0 }}
        disabled={session.pendingSync}
      >
        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              {/* The icon is what separates cardio from a lift at a glance,
                  scrolling past at speed. */}
              <FavoriteRounded sx={{ fontSize: 15, color: ink.accent, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em' }} noWrap>
                {session.activityName}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              {session.pendingSync && (
                <Chip
                  size="small"
                  icon={<CloudUploadOutlined sx={{ fontSize: 12 }} />}
                  label="Pending"
                  variant="outlined"
                  color="primary"
                  sx={{ height: 20, '& .MuiChip-label': { px: 0.6, fontSize: '0.62rem' } }}
                />
              )}
              <Label sx={{ whiteSpace: 'nowrap' }}>{relativeDay(session.date)}</Label>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
            <Label>{clock(session.durationSeconds)}</Label>
            {session.distanceMeters > 0 && <Label>{km(session.distanceMeters)}</Label>}
            {/* Pace leads in accent because it is the progress signal; duration
                and distance are just what produced it. */}
            {perKm && <Label sx={{ color: 'primary.main' }}>{perKm} /km</Label>}
            {effort && <Label sx={{ color: 'text.secondary' }}>{effort}</Label>}
          </Stack>

          {session.notes && (
            <Typography
              sx={{
                mt: 0.75,
                pl: 1,
                borderLeft: `2px solid ${ink.line}`,
                fontSize: '0.8rem',
                color: 'text.secondary',
              }}
            >
              {session.notes}
            </Typography>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}
