import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Switch,
  Fab,
  Tooltip,
  Avatar,
  CardActions,
  CardHeader,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  LinearProgress,
  Skeleton,
  Fade,
  Zoom,
  Slide,
  Grow,
  alpha,
  useTheme
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AutoAwesome as ParseIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  LocationOn as LocationIcon,
  Description,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Storage as StorageIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
  FileCopy as FileCopyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import axios from 'axios';
import { LLMSettingsDialog } from './LLMSettingsDialog';
import { useAuth } from '../auth/AuthContext';
import * as docx from 'docx-preview';

// File Viewer Component
const FileViewer: React.FC<{ cv: CV; token: string | null }> = ({ cv, token }) => {
  const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const [fileError, setFileError] = React.useState<string | null>(null);
  const viewerRef = React.useRef<HTMLDivElement | null>(null);
  const [loadingDocx, setLoadingDocx] = React.useState(false);
  
  // For PDF files, try to use iframe
  if (cv.filename.toLowerCase().endsWith('.pdf')) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'grey.300' }}>
          <Typography variant="caption" color="text.secondary">
            PDF Viewer (if available)
          </Typography>
        </Box>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <iframe
            src={`${API}/cv/${cv.id}/view`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title={cv.filename}
            onError={() => setFileError('Failed to load PDF file')}
          />
          {fileError && (
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: 'background.paper'
            }}>
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <Typography variant="h6" color="error" sx={{ mb: 1 }}>
                  File Not Available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The original file is no longer available in storage.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // For DOCX files, try client-side rendering via data URL endpoint
  if (cv.filename.toLowerCase().endsWith('.docx')) {
    React.useEffect(() => {
      let cancelled = false;
      const loadDocx = async () => {
        setLoadingDocx(true);
        try {
          const res = await fetch(`${API}/cv/${cv.id}/view`);
          if (!res.ok) throw new Error('Failed to fetch docx');
          const data = await res.json();
          const { data_url } = data;
          const response = await fetch(data_url);
          const arrayBuffer = await response.arrayBuffer();
          if (!cancelled && viewerRef.current) {
            viewerRef.current.innerHTML = '';
            await docx.renderAsync(arrayBuffer, viewerRef.current);
          }
        } catch (err) {
          if (!cancelled) setFileError('Unable to render DOCX preview');
        } finally {
          if (!cancelled) setLoadingDocx(false);
        }
      };
      loadDocx();
      return () => { cancelled = true; };
    }, [cv.id, API]);

    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'grey.300' }}>
          <Typography variant="caption" color="text.secondary">
            DOCX Preview (experimental)
          </Typography>
        </Box>
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto', p: 2 }}>
          {loadingDocx && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">Loading DOCX...</Typography>
            </Box>
          )}
          <div ref={viewerRef} />
          {fileError && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                Unable to preview DOCX inline. You can still download the file or view extracted text below.
              </Alert>
            </Box>
          )}
        </Box>
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              const link = document.createElement('a');
              link.href = `${API}/cv/${cv.id}/file`;
              link.download = cv.filename;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Download File
          </Button>
        </Box>
      </Box>
    );
  }

  // For non-PDF files, show text content and download link
  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {cv.filename}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const link = document.createElement('a');
            link.href = `${API}/cv/${cv.id}/file`;
            link.download = cv.filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          sx={{ ml: 'auto' }}
        >
          Download File
        </Button>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
        Extracted Text Content:
      </Typography>
      <Typography variant="body1" component="pre" sx={{ 
        whiteSpace: 'pre-wrap', 
        fontFamily: 'inherit',
        lineHeight: 1.6,
        fontSize: '0.875rem',
        bgcolor: 'grey.50',
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'grey.200'
      }}>
        {cv.content || 'No text content available'}
      </Typography>
      
      <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
        <Typography variant="body2" color="warning.dark">
          ⚠️ Note: The original file may not be available for download if it was uploaded before the storage reset.
        </Typography>
      </Box>
    </Box>
  );
};

interface CV {
  id: number;
  filename: string;
  content: string;
  uploaded_at: string;
  parsed_metadata?: any;
  embedding_vector?: any;
  collection_id?: number;
}

interface CVCollection {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  cv_count: number;
}

interface LLMConfig {
  llm_provider: 'openai' | 'gemini';
  llm_api_key: string;
  llm_model_name: string;
  llm_temperature: number;
  llm_top_p: number;
  llm_max_tokens: number;
  embedding_provider: 'local' | 'openai' | 'gemini';
  embedding_api_key?: string;
  embedding_model_name: string;
}

export const CVManagementPage: React.FC = () => {
  const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const { token } = useAuth();
  const theme = useTheme();
  const [collections, setCollections] = useState<CVCollection[]>([]);
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState<number | null>(null);
  const [autoParse, setAutoParse] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showCVDetailDialog, setShowCVDetailDialog] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CVCollection | null>(null);
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/cv/collections`, { headers });
      setCollections(response.data.collections);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch collections');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCVs = async (collectionId?: number) => {
    try {
      const url = collectionId 
        ? `${API}/cv/list?collection_id=${collectionId}`
        : `${API}/cv/list`;
      const response = await axios.get(url, { headers });
      setCvs(response.data.cvs);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch CVs');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedCollection) {
          formData.append('collection_id', selectedCollection.toString());
        }

        await axios.post(`${API}/cv/upload`, formData, { 
          headers: { 
            ...headers, 
            'Content-Type': 'multipart/form-data' 
          } 
        });
      }

      setSuccess(`${selectedFiles.length} CV(s) uploaded successfully!`);
      setSelectedFiles([]);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Refresh data immediately
      if (selectedCollection) {
        await fetchCVs(selectedCollection);
      }
      await fetchCollections();

      // Auto parse if enabled
      if (autoParse) {
        // Get the latest CVs to find the newly uploaded ones
        const latestCVs = await axios.get(`${API}/cv/list?collection_id=${selectedCollection}`, { headers });
        const newCVs = latestCVs.data.cvs.filter((cv: CV) => 
          selectedFiles.some(file => file.name === cv.filename)
        );
        
        // Parse each new CV
        for (const cv of newCVs) {
          try {
            await axios.post(`${API}/llm/parse/${cv.id}`, {}, { headers });
          } catch (err) {
            console.error(`Failed to auto-parse CV ${cv.filename}:`, err);
          }
        }
        
        // Refresh CVs again to show parsed data
        if (selectedCollection) {
          await fetchCVs(selectedCollection);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload CV(s)');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cvId: number) => {
    if (!window.confirm('Are you sure you want to delete this CV?')) return;

    try {
      await axios.delete(`${API}/cv/${cvId}`, { headers });
      setSuccess('CV deleted successfully!');
      fetchCVs(selectedCollection || undefined);
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete CV');
    }
  };

  const handleView = async (cv: CV) => {
    try {
      const response = await axios.get(`${API}/cv/${cv.id}/content`, { headers });
      setSelectedCV({ 
        ...cv, 
        content: response.data.content,
        parsed_metadata: response.data.parsed_metadata 
      });
      setShowViewDialog(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch CV content');
    }
  };

  const handleCVClick = async (cv: CV) => {
    try {
      const response = await axios.get(`${API}/cv/${cv.id}/content`, { headers });
      setSelectedCV({ 
        ...cv, 
        content: response.data.content,
        parsed_metadata: response.data.parsed_metadata 
      });
      setShowCVDetailDialog(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch CV content');
    }
  };

  const handleParse = async (cvId: number) => {
    setParsing(cvId);
    setError(null);
    setSuccess(null);

    try {
      await axios.post(`${API}/llm/parse/${cvId}`, {}, { headers });
      setSuccess('CV parsed successfully!');
      
      // Update selectedCV if it's the same CV being parsed
      if (selectedCV && selectedCV.id === cvId) {
        const response = await axios.get(`${API}/cv/${cvId}/content`, { headers });
        setSelectedCV({ 
          ...selectedCV, 
          parsed_metadata: response.data.parsed_metadata 
        });
      }
      
      // Refresh CVs list to update the parsed status
      fetchCVs(selectedCollection || undefined);
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to parse CV');
    } finally {
      setParsing(null);
    }
  };

  const handleCreateCollection = async () => {
    try {
      await axios.post(`${API}/cv/collections`, collectionForm, { headers });
      setSuccess('CV Collection created successfully!');
      setShowCollectionDialog(false);
      setCollectionForm({ name: '', description: '' });
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create collection');
    }
  };

  const handleUpdateCollection = async () => {
    if (!editingCollection) return;
    
    try {
      await axios.put(`${API}/cv/collections/${editingCollection.id}`, collectionForm, { headers });
      setSuccess('CV Collection updated successfully!');
      setShowCollectionDialog(false);
      setEditingCollection(null);
      setCollectionForm({ name: '', description: '' });
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update collection');
    }
  };

  const handleDeleteCollection = async (collectionId: number) => {
    if (!window.confirm('Are you sure you want to delete this collection? All CVs in this collection will also be deleted.')) return;

    try {
      await axios.delete(`${API}/cv/collections/${collectionId}`, { headers });
      setSuccess('CV Collection deleted successfully!');
      fetchCollections();
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
        setCvs([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete collection');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderParsedMetadata = (metadata: any) => {
    if (!metadata) return null;

    const fields = [
      { key: 'full_name', label: 'Full Name', icon: <PersonIcon />, color: theme.palette.primary.main },
      { key: 'email', label: 'Email', icon: <EmailIcon />, color: theme.palette.primary.main },
      { key: 'phone', label: 'Phone', icon: <PhoneIcon />, color: theme.palette.primary.main },
      { key: 'location', label: 'Location', icon: <LocationIcon />, color: theme.palette.primary.main },
      { key: 'current_position', label: 'Current Position', icon: <WorkIcon />, color: theme.palette.primary.main },
      { key: 'skills', label: 'Skills', icon: <WorkIcon />, color: theme.palette.primary.main },
      { key: 'education', label: 'Education', icon: <SchoolIcon />, color: theme.palette.primary.main },
      { key: 'experience', label: 'Experience', icon: <WorkIcon />, color: theme.palette.primary.main },
    ];

    const renderValue = (value: any) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return 'None';
        
        // Handle array of objects (education, experience)
        if (typeof value[0] === 'object' && value[0] !== null) {
          return (
            <Box>
              {value.map((item, index) => (
                <Box key={index} sx={{ mb: 1, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
                  {Object.entries(item).map(([key, val]) => (
                    <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                      <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong> {String(val || 'N/A')}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          );
        }
        
        // Handle array of strings (skills)
        return value.join(', ');
      }
      
      return String(value || 'N/A');
    };

    return (
      <Box>
        <Grid container spacing={1}>
          {fields.map((field) => {
            const value = metadata[field.key];
            if (!value) return null;
            
            return (
              <Grid item xs={12} key={field.key}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: alpha(field.color, 0.05),
                  border: `1px solid ${alpha(field.color, 0.2)}`
                }}>
                  <Box sx={{ color: field.color, mt: 0.5 }}>
                    {field.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {field.label}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {renderValue(value)}
                    </Box>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  const getCollectionColor = (index: number) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.info.main,
      theme.palette.success.main,
    ];
    return colors[index % colors.length];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileCopyIcon />;
      case 'doc':
      case 'docx': return <Description />;
      case 'txt': return <Description />;
      default: return <FileCopyIcon />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        CV Collections Management
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Organize and manage your CVs into collections for better organization
      </Typography>

      <Box sx={{ 
        mb: 4, 
        background: 'white',
        border: `2px solid ${theme.palette.secondary.main}`,
        borderRadius: 3,
        p: 4,
        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.15)}`
      }}>
        {/* Enhanced Stats Cards */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              borderRadius: 3,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.15)}`,
                border: `1px solid ${theme.palette.primary.main}`,
              }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  mb: 2
                }}>
                  <StorageIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
                </Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 700, 
                  color: theme.palette.primary.main,
                  mb: 1
                }}>
                  {collections.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Collections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`,
              border: `1px solid ${alpha(theme.palette.secondary.main, 0.25)}`,
              borderRadius: 3,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.secondary.main, 0.15)}`,
                border: `1px solid ${theme.palette.secondary.main}`,
              }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.secondary.main, 0.15),
                  mb: 2
                }}>
                  <FileCopyIcon sx={{ fontSize: 28, color: theme.palette.secondary.main }} />
                </Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 700, 
                  color: theme.palette.secondary.main,
                  mb: 1
                }}>
                  {collections.reduce((sum, c) => sum + c.cv_count, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Total CVs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.success.main, 0.06)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              borderRadius: 3,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.success.main, 0.15)}`,
                border: `1px solid ${theme.palette.success.main}`,
              }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.15),
                  mb: 2
                }}>
                  <CheckCircleIcon sx={{ fontSize: 28, color: theme.palette.success.main }} />
                </Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 700, 
                  color: theme.palette.success.main,
                  mb: 1
                }}>
                  {collections.filter(c => c.cv_count > 0).length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Active Collections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.12)} 0%, ${alpha(theme.palette.warning.main, 0.06)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
              borderRadius: 3,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${alpha(theme.palette.warning.main, 0.15)}`,
                border: `1px solid ${theme.palette.warning.main}`,
              }
            }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.warning.main, 0.15),
                  mb: 2
                }}>
                  <TrendingUpIcon sx={{ fontSize: 28, color: theme.palette.warning.main }} />
                </Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 700, 
                  color: theme.palette.warning.main,
                  mb: 1
                }}>
                  {Math.round((collections.filter(c => c.cv_count > 0).length / Math.max(collections.length, 1)) * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Utilization Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Enhanced Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Slide}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error" 
          sx={{ 
            width: '100%',
            boxShadow: theme.shadows[8],
            borderRadius: 2
          }}
          icon={<ErrorIcon />}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Slide}
      >
        <Alert 
          onClose={() => setSuccess(null)} 
          severity="success" 
          sx={{ 
            width: '100%',
            boxShadow: theme.shadows[8],
            borderRadius: 2
          }}
          icon={<CheckCircleIcon />}
        >
          {success}
        </Alert>
      </Snackbar>

      {!selectedCollection ? (
        <>
          {/* Enhanced Collections Grid */}
          {isLoading ? (
            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Card sx={{ height: 200 }}>
                    <CardContent>
                      <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="40%" />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {collections.map((collection, index) => (
                <Grid item xs={12} sm={6} md={4} key={collection.id}>
                  <Grow in timeout={300 + index * 100}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease-in-out',
                        background: `linear-gradient(135deg, ${alpha(getCollectionColor(index), 0.05)} 0%, ${alpha(getCollectionColor(index), 0.02)} 100%)`,
                        border: `1px solid ${alpha(getCollectionColor(index), 0.2)}`,
                        '&:hover': { 
                          transform: 'translateY(-4px)',
                          boxShadow: theme.shadows[12],
                          border: `1px solid ${getCollectionColor(index)}`,
                        }
                      }}
                      onClick={() => {
                        setSelectedCollection(collection.id);
                        setCurrentPage(0); // Reset to first page
                        fetchCVs(collection.id);
                      }}
                    >
                      <CardHeader
                        avatar={
                          <Avatar 
                            sx={{ 
                              bgcolor: getCollectionColor(index),
                              width: 56,
                              height: 56,
                              boxShadow: theme.shadows[4]
                            }}
                          >
                            <FolderIcon sx={{ fontSize: 28 }} />
                          </Avatar>
                        }
                        action={
                          <Box>
                            <Tooltip title="Edit Collection">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCollection(collection);
                                  setCollectionForm({ name: collection.name, description: collection.description || '' });
                                  setShowCollectionDialog(true);
                                }}
                                sx={{ 
                                  color: getCollectionColor(index),
                                  '&:hover': { bgcolor: alpha(getCollectionColor(index), 0.1) }
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Collection">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCollection(collection.id);
                                }}
                                sx={{ 
                                  color: theme.palette.error.main,
                                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        }
                        title={
                          <Typography variant="h6" sx={{ fontWeight: 600, color: getCollectionColor(index) }}>
                            {collection.name}
                          </Typography>
                        }
                        subheader={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip 
                              label={`${collection.cv_count} CVs`} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              Updated {formatDate(collection.updated_at)}
                            </Typography>
                          </Box>
                        }
                      />
                      <CardContent>
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          minHeight: 40,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {collection.description || 'No description provided'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Enhanced Create Collection FAB */}
          <Zoom in timeout={500}>
            <Fab
              color="primary"
              aria-label="add collection"
              onClick={() => {
                setEditingCollection(null);
                setCollectionForm({ name: '', description: '' });
                setShowCollectionDialog(true);
              }}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                boxShadow: theme.shadows[8],
                '&:hover': {
                  background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.secondary.dark} 90%)`,
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              <AddIcon />
            </Fab>
          </Zoom>
        </>
      ) : (
        <>
          {/* Enhanced Collection Header */}
          <Fade in timeout={300}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 3,
              p: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={() => {
                    setSelectedCollection(null);
                    setCvs([]);
                  }}
                  sx={{ 
                    color: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Box>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                    {collections.find(c => c.id === selectedCollection)?.name}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    {collections.find(c => c.id === selectedCollection)?.description || 'No description'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Edit Collection">
                  <IconButton
                    onClick={() => {
                      const collection = collections.find(c => c.id === selectedCollection);
                      if (collection) {
                        setEditingCollection(collection);
                        setCollectionForm({ name: collection.name, description: collection.description || '' });
                        setShowCollectionDialog(true);
                      }
                    }}
                    sx={{ 
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Collection">
                  <IconButton
                    onClick={() => handleDeleteCollection(selectedCollection!)}
                    sx={{ 
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Fade>

          {/* Enhanced Upload Section */}
          <Fade in timeout={400}>
            <Card sx={{ 
              mb: 3,
              background: alpha(theme.palette.primary.main, 0.02),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                    <CloudUploadIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Upload CV to Collection
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    sx={{ 
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      '&:hover': { 
                        borderColor: theme.palette.primary.dark,
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                  >
                    Select Files
                    <input
                      type="file"
                      hidden
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.rtf"
                      onChange={handleFileSelect}
                    />
                  </Button>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoParse}
                        onChange={(e) => setAutoParse(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto parse after upload"
                    sx={{ ml: 2 }}
                  />
                  {selectedFiles.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedFiles.map((file, index) => (
                        <Chip 
                          key={index}
                          label={file.name} 
                          color="primary" 
                          variant="outlined"
                          icon={<FileCopyIcon />}
                          onDelete={() => {
                            setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                          }}
                        />
                      ))}
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
                    sx={{ 
                      bgcolor: theme.palette.primary.main,
                      '&:hover': {
                        bgcolor: theme.palette.primary.dark,
                      }
                    }}
                  >
                    {loading ? 'Uploading...' : `Upload ${selectedFiles.length} CV(s)`}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Fade>

                    {/* Enhanced CVs List */}
          {cvs.length === 0 ? (
            <Fade in timeout={500}>
              <Box sx={{ 
                textAlign: 'center', 
                py: 8,
                background: alpha(theme.palette.primary.main, 0.02),
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }}>
                <Avatar sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: theme.palette.primary.main,
                  mx: 'auto',
                  mb: 2
                }}>
                  <FileCopyIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                  No CVs in this collection yet
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Upload your first CV to get started with this collection
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  component="label"
                  sx={{ 
                    bgcolor: theme.palette.primary.main,
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark,
                    }
                  }}
                >
                  Upload First CV
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.txt,.rtf"
                    onChange={handleFileSelect}
                  />
                </Button>
              </Box>
            </Fade>
          ) : (
            <Box>
              {/* CV List Header */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 2,
                p: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 2
              }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  CV List ({cvs.length} files)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Show:
                  </Typography>
                  <Select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    size="small"
                    sx={{ minWidth: 80 }}
                  >
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                  </Select>
                </Box>
              </Box>

              {/* CV List */}
              <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                {cvs
                  .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                  .map((cv, index) => (
                  <Grow in timeout={300 + index * 50} key={cv.id}>
                    <Box>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        p: 2,
                        borderBottom: index < cvs.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': { 
                          bgcolor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                      onClick={() => {
                        handleCVClick(cv);
                      }}
                      >
                        {/* File Icon */}
                        <Avatar sx={{ 
                          bgcolor: theme.palette.primary.main,
                          width: 40,
                          height: 40,
                          mr: 2
                        }}>
                          {getFileIcon(cv.filename)}
                        </Avatar>

                        {/* File Info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography 
                            variant="subtitle1" 
                            sx={{ 
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={cv.filename}
                          >
                            {cv.filename}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(cv.uploaded_at)}
                              </Typography>
                            </Box>
                            {cv.parsed_metadata && (
                              <Chip 
                                label="Parsed" 
                                size="small" 
                                color="success" 
                                variant="outlined"
                                icon={<CheckCircleIcon />}
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Actions */}
                        <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                          <Tooltip title="View CV">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(cv);
                              }}
                              sx={{ color: theme.palette.info.main }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Parse CV">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleParse(cv.id);
                              }}
                              disabled={parsing === cv.id}
                              sx={{ color: theme.palette.warning.main }}
                            >
                              {parsing === cv.id ? <CircularProgress size={16} /> : <ParseIcon />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete CV">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cv.id);
                              }}
                              sx={{ color: theme.palette.error.main }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                  </Grow>
                                 ))}
               </Paper>

               {/* Pagination */}
               {cvs.length > pageSize && (
                 <Box sx={{ 
                   display: 'flex', 
                   justifyContent: 'center', 
                   alignItems: 'center', 
                   gap: 2, 
                   mt: 3,
                   p: 2,
                   bgcolor: alpha(theme.palette.primary.main, 0.02),
                   borderRadius: 2
                 }}>
                   <Button
                     variant="outlined"
                     size="small"
                     onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                     disabled={currentPage === 0}
                   >
                     Previous
                   </Button>
                   <Typography variant="body2" color="text.secondary">
                     Page {currentPage + 1} of {Math.ceil(cvs.length / pageSize)}
                   </Typography>
                   <Button
                     variant="outlined"
                     size="small"
                     onClick={() => setCurrentPage(Math.min(Math.ceil(cvs.length / pageSize) - 1, currentPage + 1))}
                     disabled={currentPage >= Math.ceil(cvs.length / pageSize) - 1}
                   >
                     Next
                   </Button>
                 </Box>
               )}
             </Box>
          )}
        </>
      )}

      {/* Enhanced Dialogs */}
      <Dialog 
        open={showCollectionDialog} 
        onClose={() => setShowCollectionDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: theme.shadows[12]
          }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <FolderIcon />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingCollection ? 'Edit Collection' : 'Create New Collection'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={collectionForm.name}
            onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
            sx={{ mb: 3 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={collectionForm.description}
            onChange={(e) => setCollectionForm({ ...collectionForm, description: e.target.value })}
            placeholder="Describe what this collection is for..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setShowCollectionDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={editingCollection ? handleUpdateCollection : handleCreateCollection}
            variant="contained"
            disabled={!collectionForm.name.trim()}
            startIcon={editingCollection ? <EditIcon /> : <AddIcon />}
            sx={{ 
              borderRadius: 2,
              background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.secondary.dark} 90%)`,
              }
            }}
          >
            {editingCollection ? 'Update Collection' : 'Create Collection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced View CV Dialog */}
      <Dialog 
        open={showViewDialog} 
        onClose={() => setShowViewDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: theme.shadows[12]
          }
        }}
      >
        <DialogTitle sx={{ 
          background: alpha(theme.palette.primary.main, 0.05),
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              {selectedCV && getFileIcon(selectedCV.filename)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedCV?.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded {selectedCV && selectedCV.uploaded_at ? formatDate(selectedCV.uploaded_at) : 'Unknown'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ 
            height: '70vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* File Viewer */}
            <Box sx={{ 
              flex: 1,
              border: `1px solid ${alpha(theme.palette.grey[300], 0.5)}`,
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              {selectedCV && token && (
                <FileViewer cv={selectedCV} token={token} />
              )}
            </Box>
            

          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setShowViewDialog(false)}
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* CV Detail Dialog */}
      <Dialog 
        open={showCVDetailDialog} 
        onClose={() => setShowCVDetailDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: theme.shadows[12]
          }
        }}
      >
        <DialogTitle sx={{ 
          background: alpha(theme.palette.primary.main, 0.05),
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              {selectedCV && getFileIcon(selectedCV.filename)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedCV?.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded {selectedCV && selectedCV.uploaded_at ? formatDate(selectedCV.uploaded_at) : 'Unknown'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedCV?.parsed_metadata ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.primary.main }}>
                Parsed Information
              </Typography>
              {renderParsedMetadata(selectedCV.parsed_metadata)}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ 
                width: 60, 
                height: 60, 
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: theme.palette.warning.main,
                mx: 'auto',
                mb: 2
              }}>
                <ParseIcon />
              </Avatar>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                No parsed data available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This CV hasn't been parsed yet. Click the parse button to extract information.
              </Typography>
              <Button
                variant="contained"
                startIcon={parsing === selectedCV?.id ? <CircularProgress size={16} /> : <ParseIcon />}
                onClick={() => {
                  if (selectedCV) {
                    handleParse(selectedCV.id);
                  }
                }}
                disabled={parsing === selectedCV?.id}
                sx={{ 
                  bgcolor: theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark,
                  }
                }}
              >
                {parsing === selectedCV?.id ? 'Parsing...' : 'Parse CV'}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setShowCVDetailDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
          {selectedCV && (
            <Button 
              onClick={() => {
                handleView(selectedCV);
                setShowCVDetailDialog(false);
              }}
              variant="contained"
              startIcon={<ViewIcon />}
              sx={{ 
                borderRadius: 2,
                bgcolor: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                }
              }}
            >
              View Full CV
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

 