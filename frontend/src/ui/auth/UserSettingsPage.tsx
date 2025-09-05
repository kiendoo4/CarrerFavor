import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Avatar,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Snackbar
} from '@mui/material';
import {
  Save as SaveIcon,
  PhotoCamera as PhotoCameraIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { LLMSettingsDialog } from '../hr/LLMSettingsDialog';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface LLMConfig {
  llm_provider: 'openai' | 'gemini';
  llm_api_key: string;
  llm_model_name: string;
  llm_temperature: number;
  llm_top_p: number;
  llm_max_tokens: number;
}

export const UserSettingsPage: React.FC = () => {
  const { token, user, reloadUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [showLLMDialog, setShowLLMDialog] = useState(false);
  
  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchLLMConfig();
    fetchCurrentAvatar();
  }, [user?.avatar_path, user?.id]);

  const fetchCurrentAvatar = async () => {
    if (user?.avatar_path) {
      try {
        const response = await axios.get(`${API}/auth/avatar/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAvatar(response.data.avatar_url);
      } catch (error) {
        console.error('Failed to fetch avatar URL:', error);
        setAvatar('/default_image/default_avatar.jpeg');
      }
    } else {
      setAvatar('/default_image/default_avatar.jpeg');
    }
  };

  const fetchLLMConfig = async () => {
    try {
      const response = await axios.get(`${API}/llm/config`, { headers });
      setLlmConfig(response.data);
    } catch (err) {
      console.error('Error fetching LLM config:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatar(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      await axios.post(`${API}/auth/avatar`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Avatar updated successfully!');
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Reload user data to update avatar in navigation
      await reloadUser();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update avatar');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, { headers });

      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLLMConfigUpdate = async (config: LLMConfig) => {
    try {
      await axios.post(`${API}/llm/config`, config, { headers });
      setLlmConfig(config);
      setShowLLMDialog(false);
      setSuccess('LLM configuration updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update LLM configuration');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account settings, avatar, and LLM configuration
        </Typography>
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        {/* Profile Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Profile Information
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar
                  src={avatar || '/default_image/default_avatar.jpeg'}
                  sx={{ width: 120, height: 120, mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCameraIcon />}
                    size="small"
                  >
                    Upload Avatar
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </Button>
                  {selectedFile && (
                    <Button
                      variant="contained"
                      onClick={handleAvatarUpload}
                      disabled={loading}
                      size="small"
                    >
                      {loading ? <CircularProgress size={20} /> : 'Save'}
                    </Button>
                  )}
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Email"
                value={user?.email || ''}
                disabled
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Role"
                value={user?.role || ''}
                disabled
                sx={{ mb: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Password Change Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <LockIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Change Password
                </Typography>
              </Box>

              <TextField
                fullWidth
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                onClick={handlePasswordChange}
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                fullWidth
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* LLM Configuration Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SettingsIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    LLM Configuration
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setShowLLMDialog(true)}
                >
                  Configure LLM
                </Button>
              </Box>

              {llmConfig ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      LLM Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Provider: {llmConfig.llm_provider}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Model: {llmConfig.llm_model_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Temperature: {llmConfig.llm_temperature}
                    </Typography>
                    {llmConfig.llm_provider !== 'gemini' && (
                      <Typography variant="body2" color="text.secondary">
                        Max Tokens: {llmConfig.llm_max_tokens}
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No LLM configuration found. Please configure to enable CV matching.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* LLM Settings Dialog */}
      <LLMSettingsDialog
        open={showLLMDialog}
        onClose={() => setShowLLMDialog(false)}
        onSave={handleLLMConfigUpdate}
        initialConfig={llmConfig}
      />
    </Container>
  );
}; 