import { useState, useEffect } from 'react';
import {
  Typography, Box, CircularProgress, FormControl, InputLabel,
  Select, MenuItem, ToggleButton, ToggleButtonGroup, Card, CardContent
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { exercisesApi } from '../api/exercises';
import { progressApi } from '../api/progress';

export default function ProgressPage() {
  const [categories, setCategories] = useState([]);
  const [exerciseId, setExerciseId] = useState('');
  const [metric, setMetric] = useState('maxWeight');
  const [chartType, setChartType] = useState('line');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    exercisesApi.list().then(setCategories).catch(console.error).finally(() => setInitLoading(false));
  }, []);

  useEffect(() => {
    if (!exerciseId) return;
    setLoading(true);
    progressApi.get(exerciseId, metric)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [exerciseId, metric]);

  if (initLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  const allExercises = categories.flatMap(c => c.exercises);
  const chartData = data.map(d => ({ ...d, date: new Date(d.date) }));
  const metricLabel = metric === 'maxWeight' ? 'Max Weight' : 'Total Volume';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Progress</Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Exercise</InputLabel>
        <Select value={exerciseId} label="Exercise"
          onChange={e => setExerciseId(e.target.value)}>
          {allExercises.map(ex => (
            <MenuItem key={ex.id} value={ex.id}>{ex.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Metric</InputLabel>
          <Select value={metric} label="Metric" onChange={e => setMetric(e.target.value)}>
            <MenuItem value="maxWeight">Max Weight</MenuItem>
            <MenuItem value="totalVolume">Total Volume</MenuItem>
          </Select>
        </FormControl>

        <ToggleButtonGroup value={chartType} exclusive
          onChange={(_, v) => { if (v) setChartType(v); }}>
          <ToggleButton value="line">Line</ToggleButton>
          <ToggleButton value="bar">Bar</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && <CircularProgress />}

      {!loading && exerciseId && chartData.length > 0 && (
        <Card>
          <CardContent>
            {chartType === 'line' ? (
              <LineChart
                xAxis={[{
                  data: chartData.map(d => d.date),
                  scaleType: 'time',
                  label: 'Date',
                }]}
                series={[{
                  data: chartData.map(d => Number(d.value)),
                  label: metricLabel,
                  color: '#90caf9',
                }]}
                height={300}
              />
            ) : (
              <BarChart
                xAxis={[{
                  data: chartData.map(d => d.date),
                  scaleType: 'band',
                  valueFormatter: (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                }]}
                series={[{
                  data: chartData.map(d => Number(d.value)),
                  label: metricLabel,
                  color: '#90caf9',
                }]}
                height={300}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!loading && exerciseId && chartData.length === 0 && (
        <Typography color="text.secondary">No data yet for this exercise. Log some workouts first.</Typography>
      )}

      {!exerciseId && (
        <Typography color="text.secondary">Select an exercise to view your progress.</Typography>
      )}
    </Box>
  );
}
