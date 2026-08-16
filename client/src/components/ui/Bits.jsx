import { Box, Typography, Skeleton, Stack, Card, CardContent } from '@mui/material';
import { MONO, ink } from '../../theme';

/** Mono, tracked-out, uppercase. Every label and annotation in the app. */
export function Label({ children, sx, component = 'div' }) {
  return (
    <Typography
      component={component}
      sx={{
        fontFamily: MONO,
        fontSize: '0.66rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: 'text.secondary',
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

/** A number with its unit and a mono caption underneath. */
export function Stat({ label, value, unit, accent = false, sx }) {
  return (
    <Box sx={sx}>
      <Typography
        sx={{
          fontSize: '1.5rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          color: accent ? 'primary.main' : 'text.primary',
        }}
      >
        {value}
        {unit && (
          <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 600, ml: 0.4, color: 'text.secondary' }}>
            {unit}
          </Typography>
        )}
      </Typography>
      <Label sx={{ mt: 0.25 }}>{label}</Label>
    </Box>
  );
}

/** Section heading with a hairline rule running off to the right. */
export function SectionHeader({ children, action }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
      <Label sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}>{children}</Label>
      <Box sx={{ flex: 1, height: '1px', bgcolor: ink.line }} />
      {action}
    </Stack>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <Box
      className="hatch-bg"
      sx={{ textAlign: 'center', py: 6, px: 3, border: `1px solid ${ink.line}` }}
    >
      {icon && <Box sx={{ color: 'text.secondary', mb: 1.5, '& svg': { fontSize: 40 } }}>{icon}</Box>}
      <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: action ? 2.5 : 0, fontSize: '0.9rem' }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}

/**
 * Skeletons rather than a centred spinner. A spinner tells you nothing about
 * what is coming and makes the layout jump when it resolves; a skeleton in the
 * shape of the content does neither.
 */
export function CardSkeleton({ lines = 3 }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent>
        <Skeleton variant="text" width="45%" height={26} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${85 - i * 12}%`} height={18} />
        ))}
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ count = 4, lines = 2 }) {
  return (
    <Box>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </Box>
  );
}
