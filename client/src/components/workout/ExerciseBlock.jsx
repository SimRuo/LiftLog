import { useState } from 'react';
import {
  Card,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Stack,
} from '@mui/material';
import {
  MoreVertRounded,
  AddRounded,
  TimerOutlined,
  TrendingUpRounded,
} from '@mui/icons-material';
import SetRow from './SetRow';
import { Label } from '../ui/Bits';
import { ink, MONO } from '../../theme';
import { e1rm, kg } from '../../lib/format';

const REST_OPTIONS = [60, 90, 120, 180, 240, 300];

export default function ExerciseBlock({
  exercise,
  onUpdateSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onSetRest,
}) {
  const [menuEl, setMenuEl] = useState(null);
  const [restEl, setRestEl] = useState(null);

  const doneSets = exercise.sets.filter((s) => s.done);
  const allDone = doneSets.length === exercise.sets.length && doneSets.length > 0;

  // "Beat last" rather than "PR": this compares against the previous session
  // only, which is all the API gives us here. Calling it a PR would be a claim
  // the data can't support.
  const bestPrev = Math.max(0, ...(exercise.lastSessionSets || []).map((s) => e1rm(s.weight, s.reps)));
  const bestToday = Math.max(0, ...doneSets.map((s) => e1rm(s.weight, s.reps)));
  const beatLast = bestPrev > 0 && bestToday > bestPrev;

  return (
    <Card sx={{ mb: 1.5, borderColor: allDone ? ink.lineBright : ink.line }}>
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {exercise.exerciseName}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
              <Label>
                {doneSets.length}/{exercise.sets.length} sets
                {exercise.plannedReps ? ` · target ${exercise.plannedSets}×${exercise.plannedReps}` : ''}
              </Label>
              {beatLast && (
                <Chip
                  size="small"
                  icon={<TrendingUpRounded sx={{ fontSize: 13 }} />}
                  label="Beat last"
                  color="secondary"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>

          <Button
            size="small"
            variant="outlined"
            startIcon={<TimerOutlined sx={{ fontSize: 15 }} />}
            onClick={(e) => setRestEl(e.currentTarget)}
            sx={{ fontFamily: MONO, minWidth: 0, px: 1, minHeight: 32 }}
          >
            {exercise.restSeconds}s
          </Button>
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Exercise options">
            <MoreVertRounded fontSize="small" />
          </IconButton>
        </Stack>

        {exercise.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {exercise.notes}
          </Typography>
        )}
      </Box>

      {/* Column headers, once per exercise, so the previous/kg/reps columns
          don't need repeating labels on every row. */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 1, pb: 0.25 }}>
        <Box sx={{ width: 20 }} />
        <Label sx={{ width: 50, textAlign: 'center', fontSize: '0.58rem' }}>Last</Label>
      </Box>

      {exercise.sets.map((set, i) => (
        <SetRow
          key={set.id}
          index={i}
          set={set}
          previous={exercise.lastSessionSets?.[i] || null}
          onChange={(patch) => onUpdateSet(i, patch)}
          onToggleDone={() => onToggleDone(i)}
          onRemove={() => onRemoveSet(i)}
          canRemove={exercise.sets.length > 1}
        />
      ))}

      <Box sx={{ borderTop: `1px solid ${ink.line}` }}>
        <Button fullWidth size="small" startIcon={<AddRounded />} onClick={onAddSet} sx={{ color: 'text.secondary' }}>
          Add set
        </Button>
      </Box>

      <Menu anchorEl={restEl} open={!!restEl} onClose={() => setRestEl(null)}>
        <MenuItem disabled sx={{ opacity: 1 }}>
          <Label>Rest between sets</Label>
        </MenuItem>
        {REST_OPTIONS.map((s) => (
          <MenuItem
            key={s}
            selected={s === exercise.restSeconds}
            onClick={() => {
              onSetRest(s);
              setRestEl(null);
            }}
          >
            {s >= 60 ? `${s / 60} min` : `${s}s`}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem
          onClick={() => {
            setMenuEl(null);
            onRemoveExercise();
          }}
        >
          Remove from this session
        </MenuItem>
        {bestToday > 0 && (
          <MenuItem disabled sx={{ opacity: 1 }}>
            <Label>Est. 1RM today · {kg(bestToday)} kg</Label>
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}
