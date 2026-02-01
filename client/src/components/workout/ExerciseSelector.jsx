import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, List, ListItemButton,
  ListItemText, ListSubheader, TextField, Box
} from '@mui/material';
import { exercisesApi } from '../../api/exercises';

export default function ExerciseSelector({ open, onClose, onSelect }) {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      exercisesApi.list().then(setCategories).catch(console.error);
    }
  }, [open]);

  const filtered = categories
    .map(cat => ({
      ...cat,
      exercises: cat.exercises.filter(ex =>
        ex.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.exercises.length > 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Select Exercise</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 1, mt: 1 }}>
          <TextField fullWidth size="small" placeholder="Search exercises..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </Box>
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filtered.map(cat => (
            <li key={cat.category}>
              <ul style={{ padding: 0 }}>
                <ListSubheader sx={{ bgcolor: 'background.paper' }}>
                  {cat.category}
                </ListSubheader>
                {cat.exercises.map(ex => (
                  <ListItemButton key={ex.id} onClick={() => { onSelect(ex); onClose(); }}>
                    <ListItemText primary={ex.name} />
                  </ListItemButton>
                ))}
              </ul>
            </li>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
