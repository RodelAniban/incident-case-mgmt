import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Permission, ROLE_LABELS } from '../api/types';

const DRAWER_WIDTH = 232;

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardOutlinedIcon fontSize="small" />, permission: null },
  {
    label: 'Cases',
    path: '/cases',
    icon: <AssignmentOutlinedIcon fontSize="small" />,
    permission: Permission.VIEW_ASSIGNED_CASES,
  },
  {
    label: 'Threat Intel',
    path: '/threat-intel',
    icon: <ShieldOutlinedIcon fontSize="small" />,
    permission: null,
  },
  {
    label: 'Admin',
    path: '/admin/users',
    icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
    permission: Permission.MANAGE_USERS,
  },
  {
    label: 'Audit Log',
    path: '/audit-log',
    icon: <FactCheckOutlinedIcon fontSize="small" />,
    permission: Permission.VIEW_AUDIT_LOG,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((item) => item.permission === null || can(item.permission));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar sx={{ px: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontFamily: 'Georgia, serif', fontWeight: 700 }}>
            ICMS
          </Typography>
        </Toolbar>
        <Divider />
        <List sx={{ pt: 1 }}>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{ mx: 1, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { fontSize: '0.9rem' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ justifyContent: 'flex-end', gap: 1.5 }}>
            {user && (
              <>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                    {user.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ROLE_LABELS[user.role]}
                    {user.team ? ` · ${user.team.name}` : ''}
                  </Typography>
                </Box>
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem' }}>
                  {user.name.charAt(0)}
                </Avatar>
                <Tooltip title="Account security">
                  <IconButton
                    size="small"
                    aria-label="Account security"
                    onClick={() => navigate('/account/security')}
                    color={location.pathname === '/account/security' ? 'primary' : 'default'}
                  >
                    <LockOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Log out">
                  <IconButton size="small" aria-label="Log out" onClick={logout}>
                    <LogoutOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
