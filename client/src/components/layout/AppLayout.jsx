import { useState, useEffect } from 'react';
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
  Fab,
  Divider,
  Chip,
} from '@mui/material';
import {
  FitnessCenterRounded,
  PlayArrowRounded,
  ListAltRounded,
  ShowChartRounded,
  AccountCircleOutlined,
  EventNoteRounded,
  CloudOffRounded,
} from '@mui/icons-material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { useAuth } from '../../context/auth-context';
import AiChatDrawer from '../ai/AiChatDrawer';
import RestTimerBar from '../workout/RestTimerBar';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';

const navItems = [
  { label: 'History', icon: <ListAltRounded />, path: '/workouts', exact: true },
  { label: 'Train', icon: <PlayArrowRounded />, path: '/workouts/log' },
  { label: 'Plan', icon: <EventNoteRounded />, path: '/plan' },
  { label: 'Progress', icon: <ShowChartRounded />, path: '/progress' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Being told you're offline before you tap Save is worth a lot more than
  // finding out from a failed request afterwards.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const currentNav = navItems.findIndex((item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path),
  );

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  // The AI drawer is a nice-to-have; it should not float over the rest timer or
  // the finish button on the screen where every pixel is doing a job.
  const onTrainingScreen = location.pathname === '/workouts/log';

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
          {!online && (
            <Chip
              size="small"
              icon={<CloudOffRounded sx={{ fontSize: 13 }} />}
              label="Offline"
              variant="outlined"
              sx={{ mr: 1 }}
            />
          )}
          <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Account">
            <AccountCircleOutlined />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Label>Signed in as</Label>
              <Typography sx={{ fontWeight: 700 }}>{username}</Typography>
            </Box>
            <Divider />
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
        <Outlet />
      </Box>

      {!onTrainingScreen && (
        <>
          <Fab
            color="primary"
            size="medium"
            onClick={() => setChatOpen(true)}
            aria-label="Ask the coach"
            sx={{
              position: 'fixed',
              bottom: 'calc(76px + env(safe-area-inset-bottom))',
              right: 16,
              zIndex: 1100,
              borderRadius: 0,
            }}
          >
            <AutoAwesomeRounded />
          </Fab>
          <AiChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
        </>
      )}

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
          value={currentNav >= 0 ? currentNav : 0}
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
