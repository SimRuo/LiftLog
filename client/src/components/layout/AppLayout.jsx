import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, IconButton, BottomNavigation,
  BottomNavigationAction, Box, Menu, MenuItem, Paper
} from '@mui/material';
import {
  FitnessCenterRounded, AddCircleRounded, ListAltRounded,
  ShowChartRounded, AccountCircle, EventNoteRounded
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Workouts', icon: <ListAltRounded />, path: '/workouts', exact: true },
  { label: 'Log', icon: <AddCircleRounded />, path: '/workouts/log' },
  { label: 'Plan', icon: <EventNoteRounded />, path: '/plan' },
  { label: 'Progress', icon: <ShowChartRounded />, path: '/progress' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const currentNav = navItems.findIndex(item =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
  );

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="transparent" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <FitnessCenterRounded sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            LiftLog
          </Typography>
          <IconButton color="inherit" onClick={e => setAnchorEl(e.currentTarget)}>
            <AccountCircle />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>{username}</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', pb: 8, px: 2, py: 2 }}>
        <Outlet />
      </Box>

      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          value={currentNav >= 0 ? currentNav : 0}
          onChange={(_, idx) => navigate(navItems[idx].path)}
          showLabels
        >
          {navItems.map(item => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
