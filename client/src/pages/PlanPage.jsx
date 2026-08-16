import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Typography,
  Button,
  Stack,
  List,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  IconButton,
  Chip,
} from '@mui/material';
import { MoreVertRounded, AddRounded, EventNoteRounded } from '@mui/icons-material';
import { plansApi } from '../api/plans';
import { Label, EmptyState, ListSkeleton } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { ink } from '../theme';
import { kg } from '../lib/format';

export default function PlanPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [allPlans, setAllPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [menuEl, setMenuEl] = useState(null);

  useEffect(() => {
    Promise.all([plansApi.get().catch(() => null), plansApi.getAll().catch(() => [])])
      .then(([active, plans]) => {
        setPlan(active);
        setAllPlans(plans);
      })
      .finally(() => setLoading(false));
  }, []);

  const inactive = allPlans.filter((p) => !p.isActive);

  const handleDelete = async () => {
    try {
      await plansApi.delete();
      setPlan(null);
      setAllPlans((prev) => prev.filter((p) => !p.isActive));
      toast.success('Plan deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete the plan.');
    } finally {
      setDeleteOpen(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      const activated = await plansApi.activate(id);
      setPlan(activated);
      setAllPlans((prev) => prev.map((p) => ({ ...p, isActive: p.id === id })));
      toast.success(`Switched to ${activated.name}.`);
    } catch (err) {
      toast.error(err.message || 'Could not switch plans.');
    } finally {
      setSwitchOpen(false);
    }
  };

  const switchDialog = (
    <Dialog open={switchOpen} onClose={() => setSwitchOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Switch plan</DialogTitle>
      <List sx={{ pt: 0 }}>
        {inactive.map((p) => (
          <ListItemButton key={p.id} onClick={() => handleActivate(p.id)}>
            <ListItemText
              primary={p.name}
              secondary={`Created ${new Date(p.createdAt).toLocaleDateString()}`}
              primaryTypographyProps={{ fontWeight: 700 }}
            />
          </ListItemButton>
        ))}
      </List>
      <DialogActions>
        <Button onClick={() => setSwitchOpen(false)}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );

  if (loading) return <ListSkeleton count={3} lines={4} />;

  if (!plan) {
    return (
      <>
        <EmptyState
          icon={<EventNoteRounded />}
          title="No active plan"
          description="A plan tells LiftLog which day comes next and what you're aiming for."
          action={
            <Stack spacing={1} alignItems="center">
              <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/plan/edit')}>
                Create a plan
              </Button>
              {inactive.length > 0 && (
                <Button size="small" onClick={() => setSwitchOpen(true)}>
                  Reactivate a previous plan
                </Button>
              )}
            </Stack>
          }
        />
        {switchDialog}
      </>
    );
  }

  const totalSets = plan.days.reduce(
    (n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0),
    0,
  );

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Label>Active plan</Label>
          <Typography variant="h5" sx={{ mt: 0.25 }}>
            {plan.name}
          </Typography>
          <Label sx={{ mt: 0.5, color: ink.lineBright }}>
            {plan.days.length} days · {totalSets} sets per cycle
          </Label>
        </Box>
        <Button variant="contained" size="small" onClick={() => navigate('/plan/edit')}>
          Edit
        </Button>
        <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Plan options">
          <MoreVertRounded />
        </IconButton>
      </Stack>

      {plan.days.map((day, i) => (
        <Card key={day.id} sx={{ mb: 1.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${ink.line}` }}
          >
            <Chip size="small" label={`Day ${i + 1}`} color="primary" />
            <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em', flex: 1 }}>{day.name}</Typography>
            <Label>{day.exercises.reduce((n, e) => n + e.sets, 0)} sets</Label>
          </Stack>

          {day.exercises.map((ex, j) => (
            <Stack
              key={ex.id}
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              spacing={1}
              sx={{ px: 1.5, py: 0.85, borderTop: j ? `1px solid ${ink.line}` : 'none' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }} noWrap>
                  {ex.exerciseName}
                </Typography>
                {ex.notes && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }} noWrap>
                    {ex.notes}
                  </Typography>
                )}
              </Box>
              <Label sx={{ whiteSpace: 'nowrap' }}>
                {ex.sets}×{ex.reps}
                {ex.weight > 0 ? ` · ${kg(ex.weight)}kg` : ''}
              </Label>
            </Stack>
          ))}
        </Card>
      ))}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        {inactive.length > 0 && (
          <MenuItem
            onClick={() => {
              setMenuEl(null);
              setSwitchOpen(true);
            }}
          >
            Switch plan
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuEl(null);
            navigate('/plan/edit');
          }}
        >
          Edit plan
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuEl(null);
            setDeleteOpen(true);
          }}
        >
          Delete plan
        </MenuItem>
      </Menu>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete {plan.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.9rem' }}>
            The plan is removed. Workouts you already logged against it stay in your history.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {switchDialog}
    </Box>
  );
}
