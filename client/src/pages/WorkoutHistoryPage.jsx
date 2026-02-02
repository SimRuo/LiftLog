import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Box, CircularProgress, Button, Card, CardContent, Stack, Chip, Divider } from "@mui/material";
import { FitnessCenterRounded } from "@mui/icons-material";
import WorkoutCard from "../components/workout/WorkoutCard";
import { workoutsApi } from "../api/workouts";

function formatLastSets(lastSessionSets) {
  if (!lastSessionSets || lastSessionSets.length === 0) return null;
  const reps = lastSessionSets.map((s) => s.reps);
  const weight = lastSessionSets[0].weight;
  const allSameReps = reps.every((r) => r === reps[0]);
  const allSameWeight = lastSessionSets.every((s) => s.weight === weight);
  if (allSameReps && allSameWeight) {
    return `${reps.length}x${reps[0]}${weight > 0 ? ` @ ${weight}kg` : ""}`;
  }
  return lastSessionSets.map((s) => `${s.reps}${s.weight > 0 ? `@${s.weight}` : ""}`).join(", ");
}

function NextWorkoutCard() {
  const navigate = useNavigate();
  const [nextDay, setNextDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workoutsApi
      .next()
      .then(setNextDay)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!nextDay) return null;

  return (
    <Card sx={{ mb: 3, border: 1, borderColor: "primary.main" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FitnessCenterRounded color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={700}>
              Next: {nextDay.dayName}
            </Typography>
          </Stack>
          <Button variant="contained" size="small" onClick={() => navigate("/workouts/log")}>
            Start Workout
          </Button>
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        {nextDay.exercises.map((ex, i) => {
          const last = formatLastSets(ex.lastSessionSets);
          return (
            <Stack key={i} direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 0.5 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {ex.exerciseName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ex.sets} x {ex.reps}
                  {ex.weight > 0 ? ` @ ${ex.weight}kg` : ""}
                </Typography>
              </Box>
              {last && <Chip label={`Last: ${last}`} size="small" variant="outlined" color="primary" />}
            </Stack>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function WorkoutHistoryPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workoutsApi
      .list(page)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );

  const workouts = data?.items || [];
  const totalPages = Math.ceil((data?.totalCount || 0) / (data?.pageSize || 20));

  return (
    <Box>
      <NextWorkoutCard />
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Workout History
      </Typography>
      {workouts.length === 0 ? (
        <Typography color="text.secondary">No workouts yet. Tap "New" to log your first workout.</Typography>
      ) : (
        <>
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 2 }}>
              <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Typography sx={{ alignSelf: "center" }}>
                {page} / {totalPages}
              </Typography>
              <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
