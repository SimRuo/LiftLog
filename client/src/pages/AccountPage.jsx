import { useState } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import { useAuth } from '../context/auth-context';
import GoogleConnect from '../components/auth/GoogleConnect';
import PasswordSection from '../components/account/PasswordSection';
import { Label, SectionHeader } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';

export default function AccountPage() {
  const { username } = useAuth();
  const toast = useToast();
  // Bumped after a password change so GoogleConnect refetches — setting a
  // password is what flips "can disconnect Google" from false to true.
  const [googleRefresh, setGoogleRefresh] = useState(0);

  return (
    <Box>
      <SectionHeader>Account</SectionHeader>
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack spacing={0.25}>
          <Label>Signed in as</Label>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{username}</Typography>
        </Stack>
      </Card>

      <Card sx={{ p: 2, mb: 2 }}>
        <GoogleConnect onError={(msg) => toast.error(msg)} refreshSignal={googleRefresh} />
      </Card>

      <Card sx={{ p: 2 }}>
        <PasswordSection
          onError={(msg) => toast.error(msg)}
          onSuccess={(msg) => toast.success(msg)}
          onChanged={() => setGoogleRefresh((n) => n + 1)}
        />
      </Card>
    </Box>
  );
}
