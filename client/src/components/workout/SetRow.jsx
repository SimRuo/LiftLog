import { useState } from 'react';
import { Box, IconButton, Typography, TextField, Collapse, Tooltip } from '@mui/material';
import { CheckRounded, NotesRounded, CloseRounded } from '@mui/icons-material';
import NumberField from '../ui/NumberField';
import { MONO, ink } from '../../theme';
import { kg } from '../../lib/format';

/**
 * One set.
 *
 * The `previous` column is the part that changes how the screen feels. Every
 * commercial tracker shows what you did on this exact set last time, greyed
 * out, right where you're about to type — and makes it one tap to copy in.
 * That single affordance turns the common case (repeat last week, add a rep)
 * from six taps into one, and it means progressive overload is decided with
 * the number in front of you rather than from memory.
 */
export default function SetRow({
  index,
  set,
  previous,
  onChange,
  onToggleDone,
  onRemove,
  canRemove,
}) {
  const [noteOpen, setNoteOpen] = useState(!!set.notes);
  const done = set.done;

  const applyPrevious = () => {
    if (!previous) return;
    onChange({ weight: Number(previous.weight), reps: Number(previous.reps) });
    navigator.vibrate?.(8);
  };

  return (
    <Box
      className={set.justLanded ? 'set-landed' : undefined}
      sx={{
        borderTop: `1px solid ${ink.line}`,
        bgcolor: done ? 'rgba(255,77,23,0.05)' : 'transparent',
        transition: 'background-color 160ms',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 1, py: 1 }}>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.85rem',
            fontWeight: 700,
            width: 20,
            textAlign: 'center',
            color: done ? 'primary.main' : 'text.secondary',
            pb: 1.2,
          }}
        >
          {index + 1}
        </Typography>

        {/* Tap target for last session's matching set. Dashed underline marks
            it as actionable without it competing with the live inputs. */}
        <Tooltip title={previous ? 'Tap to copy last session' : ''} enterTouchDelay={300}>
          <Box
            onClick={applyPrevious}
            role={previous ? 'button' : undefined}
            sx={{
              width: 50,
              flexShrink: 0,
              pb: 1.1,
              cursor: previous ? 'pointer' : 'default',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                color: previous ? 'text.secondary' : ink.line,
                fontVariantNumeric: 'tabular-nums',
                borderBottom: previous ? `1px dashed ${ink.lineBright}` : 'none',
                display: 'inline-block',
                lineHeight: 1.5,
              }}
            >
              {previous ? `${kg(previous.weight)}×${previous.reps}` : '—'}
            </Typography>
          </Box>
        </Tooltip>

        <NumberField
          value={set.weight}
          onChange={(v) => onChange({ weight: v })}
          step={2.5}
          max={999}
          // Weight gets the wider share: it can read "142.5" where reps rarely
          // exceeds two digits.
          flex={1.3}
          label={index === 0 ? 'kg' : undefined}
          aria-label={`Set ${index + 1} weight`}
        />
        <NumberField
          value={set.reps}
          onChange={(v) => onChange({ reps: v })}
          step={1}
          max={200}
          label={index === 0 ? 'reps' : undefined}
          aria-label={`Set ${index + 1} reps`}
        />

        {/* The completion tick. Big, unmissable, and the thing that starts the
            rest timer — so the one action you take after racking the bar does
            both jobs at once. */}
        <IconButton
          onClick={onToggleDone}
          aria-label={done ? `Mark set ${index + 1} not done` : `Complete set ${index + 1}`}
          aria-pressed={done}
          sx={{
            width: 46,
            height: 42,
            flexShrink: 0,
            border: `1px solid ${done ? ink.accent : ink.line}`,
            bgcolor: done ? 'primary.main' : ink.raised,
            color: done ? ink.ground : 'text.secondary',
            '&:hover': { bgcolor: done ? 'primary.dark' : ink.raised },
          }}
        >
          <CheckRounded sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, px: 1, pb: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => setNoteOpen((o) => !o)}
          aria-label={`Note for set ${index + 1}`}
          sx={{ color: set.notes ? 'secondary.main' : ink.lineBright }}
        >
          <NotesRounded sx={{ fontSize: 15 }} />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        {canRemove && (
          <IconButton
            size="small"
            onClick={onRemove}
            aria-label={`Remove set ${index + 1}`}
            sx={{ color: ink.lineBright }}
          >
            <CloseRounded sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>

      <Collapse in={noteOpen}>
        <Box sx={{ px: 1, pb: 1.25 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Set note — RPE, form cue, how it moved"
            value={set.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
