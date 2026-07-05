import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
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
    label: 'Evidence',
    path: '/evidence',
    icon: <InventoryOutlinedIcon fontSize="small" />,
    permission: Permission.VIEW_EVIDENCE_METADATA,
  },
  {
    label: 'Chat & Notes',
    path: '/chat',
    icon: <ForumOutlinedIcon fontSize="small" />,
    permission: Permission.CHAT_ON_CASE,
  },
  {
    label: 'PIR',
    path: '/pir',
    icon: <FactCheckOutlinedIcon fontSize="small" />,
    permission: null,
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
                <Tooltip title="Log out">
                  <IconButton size="small" onClick={logout}>
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
