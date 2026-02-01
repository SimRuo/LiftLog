import { useState, useEffect } from 'react';
import {
  Typography, Box, CircularProgress, Card, CardContent,
  List, ListItem, ListItemText, TextField
} from '@mui/material';
import { exercisesApi } from '../api/exercises';

export default function ExerciseLibraryPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    exercisesApi.list().then(setCategories).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  const filtered = categories
    .map(cat => ({
      ...cat,
      exercises: cat.exercises.filter(ex =>
        ex.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.exercises.length > 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Exercise Library</Typography>
      <TextField fullWidth size="small" placeholder="Search exercises..."
        value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2 }} />
      {filtered.map(cat => (
        <Card key={cat.category} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} color="primary">
              {cat.category}
            </Typography>
            <List dense disablePadding>
              {cat.exercises.map(ex => (
                <ListItem key={ex.id} disableGutters>
                  <ListItemText primary={ex.name} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
