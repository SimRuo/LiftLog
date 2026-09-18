import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Menu,
  MenuItem,
  Paper,
  Divider,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  FitnessCenterRounded,
  PlayArrowRounded,
  FavoriteRounded,
  ListAltRounded,
  ShowChartRounded,
  AccountCircleOutlined,
  EventNoteRounded,
  CloudOffRounded,
  CloudSyncRounded,
} from '@mui/icons-material';
import { useAuth } from '../../context/auth-context';
import { useOffline } from '../../context/offline-context';
import RestTimerBar from '../workout/RestTimerBar';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';

const navItems = [
  { label: 'History', icon: <ListAltRounded />, path: '/workouts', exact: true },
  { label: 'Train', icon: <PlayArrowRounded />, path: '/workouts/log' },
  { label: 'Cardio', icon: <FavoriteRounded />, path: '/cardio' },
  { label: 'Plan', icon: <EventNoteRounded />, path: '/plan' },
  { label: 'Progress', icon: <ShowChartRounded />, path: '/progress' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, logout, readOnly } = useAuth();
  // Being told you're offline before you tap Save is worth a lot more than
  // finding out from a failed request afterwards — and once something is
  // queued, seeing that it hasn't landed yet matters just as much.
  const { online, pendingCount, syncing, sync } = useOffline();
  const [anchorEl, setAnchorEl] = useState(null);

  const currentNav = navItems.findIndex((item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path),
  );

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: `1px solid ${ink.line}` }}>
        <Toolbar sx={{ minHeight: 52, pt: 'env(safe-area-inset-top)' }}>
          <FitnessCenterRounded sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' }}
          >
            LiftLog
          </Typography>
          {pendingCount > 0 ? (
            <Tooltip
              title={
                online
                  ? 'Waiting to upload — tap to retry'
                  : `${pendingCount} saved on this device, waiting for a connection`
              }
            >
              <Chip
                size="small"
                clickable={online && !syncing}
                onClick={online && !syncing ? () => sync() : undefined}
                icon={
                  online ? (
                    <CloudSyncRounded sx={{ fontSize: 13 }} />
                  ) : (
                    <CloudOffRounded sx={{ fontSize: 13 }} />
                  )
                }
                label={syncing ? 'Syncing…' : `${pendingCount} to sync`}
                variant="outlined"
                color="primary"
                sx={{ mr: 1 }}
              />
            </Tooltip>
          ) : (
            !online && (
              <Chip
                size="small"
                icon={<CloudOffRounded sx={{ fontSize: 13 }} />}
                label="Offline"
                variant="outlined"
                sx={{ mr: 1 }}
              />
            )
          )}
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="Account"
            sx={{ color: location.pathname.startsWith('/account') ? 'primary.main' : 'inherit' }}
          >
            <AccountCircleOutlined />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Label>Signed in as</Label>
              <Typography sx={{ fontWeight: 700 }}>{username}</Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                navigate('/account');
              }}
            >
              Account
            </MenuItem>
            <MenuItem onClick={handleLogout}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          px: 2,
          py: 2,
          // Clear of the bottom nav, the rest bar, and the iOS home indicator.
          pb: 'calc(80px + env(safe-area-inset-bottom))',
          // The app is designed for a phone. On a desktop browser, letting a
          // set row stretch to 1500px would put the weight field a hand's width
          // away from the tick that completes it.
          width: '100%',
          maxWidth: 560,
          mx: 'auto',
        }}
      >
        {readOnly && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            Your session expired while you were offline. You can still read what's on this device
            and log workouts — they'll upload once you sign in again.
          </Alert>
        )}
        <Outlet />
      </Box>

      <RestTimerBar />

      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          borderTop: `1px solid ${ink.line}`,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          value={currentNav}
          onChange={(_, idx) => navigate(navItems[idx].path)}
          showLabels
        >
          {navItems.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
