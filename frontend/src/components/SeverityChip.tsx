import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CaseSeverity } from '../api/types';

const LABELS: Record<CaseSeverity, string> = {
  [CaseSeverity.CRITICAL]: 'Critical',
  [CaseSeverity.HIGH]: 'High',
  [CaseSeverity.MEDIUM]: 'Medium',
  [CaseSeverity.LOW]: 'Low',
};

export function SeverityChip({ severity }: { severity: CaseSeverity }) {
  const theme = useTheme();
  const color = theme.palette.severity[severity];
  return (
    <Chip
      label={LABELS[severity]}
      size="small"
      sx={{
        fontWeight: 700,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '0.7rem',
        letterSpacing: '0.02em',
        color,
        backgroundColor: `${color}22`,
        border: `1px solid ${color}55`,
      }}
    />
  );
}
