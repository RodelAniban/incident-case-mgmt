import { Box, Paper, Typography } from '@mui/material';

export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper variant="outlined" sx={{ p: 5, maxWidth: 480, textAlign: 'center' }}>
        <Typography
          variant="overline"
          sx={{ color: 'primary.main', letterSpacing: '0.1em', fontFamily: 'ui-monospace, monospace' }}
        >
          Roadmap Phase {phase}
        </Typography>
        <Typography variant="h5" sx={{ mt: 1, mb: 1.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </Box>
  );
}
