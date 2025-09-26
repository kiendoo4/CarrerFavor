import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  Box, 
  Container, 
  IconButton, 
  Menu, 
  MenuItem,
  Chip,
  Divider
} from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { 
  AccountCircle, 
  ExitToApp, 
  Dashboard, 
  Person, 
  Business,
  Folder,
  Settings,
  Assessment
} from '@mui/icons-material'
import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const AppLayout: React.FC = () => {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navigateToRole = () => {
    if (user?.role === 'candidate') {
      navigate('/candidate')
    } else if (user?.role === 'hr') {
      navigate('/hr')
    }
  }

  // Don't render layout while loading
  if (loading || !user) {
    return null
  }

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  // Fetch avatar URL when user changes
  React.useEffect(() => {
    const fetchAvatarUrl = async () => {
      if (user?.avatar_path) {
        try {
          const response = await axios.get(`${API}/auth/avatar/${user.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setAvatarUrl(response.data.avatar_url);
        } catch (error) {
          console.error('Failed to fetch avatar URL:', error);
          setAvatarUrl('/default_image/default_avatar.jpeg');
        }
      } else {
        setAvatarUrl('/default_image/default_avatar.jpeg');
      }
    };

    fetchAvatarUrl();
  }, [user?.avatar_path, user?.id]);

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar sx={{ px: { xs: 0 } }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5, 
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 }
              }} 
              onClick={navigateToRole}
            >
              <Dashboard sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'text.primary',
                  background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CarrerFavor
              </Typography>
            </Box>
            
            <Box sx={{ flexGrow: 1 }} />
            
            {/* Navigation buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
              <Button
                variant={window.location.pathname === '/candidate' ? 'contained' : 'outlined'}
                size="small"
                startIcon={<Person />}
                onClick={() => navigate('/candidate')}
                sx={{ minWidth: 'auto' }}
              >
                Candidate
              </Button>
              {user?.role === 'hr' && (
                <Button
                  variant={window.location.pathname === '/matching' ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<Business />}
                  onClick={() => navigate('/matching')}
                  sx={{ minWidth: 'auto' }}
                >
                  Matching
                </Button>
              )}
              {user?.role === 'hr' && (
                <Button
                  variant={window.location.pathname === '/cv-management' ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<Folder />}
                  onClick={() => navigate('/cv-management')}
                  sx={{ minWidth: 'auto' }}
                >
                  CV Management
                </Button>
              )}
              {user?.role === 'hr' && (
                <Button
                  variant={window.location.pathname === '/evaluation' ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<Assessment />}
                  onClick={() => navigate('/evaluation')}
                  sx={{ minWidth: 'auto' }}
                >
                  Evaluation
                </Button>
              )}
            </Box>

            {/* User menu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={user.role.toUpperCase()}
                size="small"
                color={user.role === 'hr' ? 'secondary' : 'primary'}
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
              />
              <IconButton
                size="large"
                aria-label="account menu"
                aria-controls="user-menu"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
                sx={{ 
                  '&:hover': { 
                    bgcolor: 'rgba(37, 99, 235, 0.08)' 
                  }
                }}
              >
                <Avatar 
                  src={avatarUrl || '/default_image/default_avatar.jpeg'}
                  sx={{ 
                    width: 36, 
                    height: 36, 
                    bgcolor: 'primary.main',
                    fontWeight: 600
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/default_image/default_avatar.jpeg';
                  }}
                >
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
              
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 220,
                    borderRadius: 2,
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  }
                }}
              >
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                    {user?.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {user?.role} Account
                  </Typography>
                </Box>
                <Divider />
                <MenuItem 
                  onClick={() => { handleClose(); navigate('/settings'); }}
                  sx={{ py: 1.5, px: 3 }}
                >
                  <Settings sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
                  Settings
                </MenuItem>
                <MenuItem 
                  onClick={() => { handleClose(); handleLogout(); }}
                  sx={{ py: 1.5, px: 3, color: 'error.main' }}
                >
                  <ExitToApp sx={{ mr: 2, fontSize: 20 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}