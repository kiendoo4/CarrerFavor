import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Button,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Divider,
  useTheme,
  alpha,
  TextField,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import {
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  CloudUpload
} from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';

interface CV {
  id: number;
  filename: string;
  uploaded_at: string;
  parsed_metadata?: {
    full_name?: string;
    email?: string;
    current_position?: string;
    skills?: string[];
  };
}

interface Collection {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  cvs: CV[];
}

const MatchingPage: React.FC = () => {
  const { token } = useAuth();
  const theme = useTheme();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<number>>(new Set());
  const [selectedCVs, setSelectedCVs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(new Set());
  const [jdText, setJdText] = useState('');
  const [jdTab, setJdTab] = useState(0);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdUploading, setJdUploading] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/matching/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      
      const data = await response.json();
      setCollections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionToggle = (collectionId: number) => {
    const newSelectedCollections = new Set(selectedCollections);
    const collection = collections.find(c => c.id === collectionId);
    
    if (newSelectedCollections.has(collectionId)) {
      newSelectedCollections.delete(collectionId);
      // Remove all CVs from this collection
      if (collection) {
        const newSelectedCVs = new Set(selectedCVs);
        collection.cvs.forEach(cv => newSelectedCVs.delete(cv.id));
        setSelectedCVs(newSelectedCVs);
      }
    } else {
      newSelectedCollections.add(collectionId);
      // Add all CVs from this collection
      if (collection) {
        const newSelectedCVs = new Set(selectedCVs);
        collection.cvs.forEach(cv => newSelectedCVs.add(cv.id));
        setSelectedCVs(newSelectedCVs);
      }
    }
    
    setSelectedCollections(newSelectedCollections);
  };

  const handleCVToggle = (cvId: number) => {
    const newSelectedCVs = new Set(selectedCVs);
    
    if (newSelectedCVs.has(cvId)) {
      newSelectedCVs.delete(cvId);
    } else {
      newSelectedCVs.add(cvId);
    }
    
    setSelectedCVs(newSelectedCVs);
  };

  const handleSelectAllCVsInCollection = (collectionId: number, checked: boolean) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    const newSelectedCVs = new Set(selectedCVs);
    
    if (checked) {
      // Select all CVs in this collection
      collection.cvs.forEach(cv => newSelectedCVs.add(cv.id));
      setSelectedCollections(prev => new Set([...prev, collectionId]));
    } else {
      // Deselect all CVs in this collection
      collection.cvs.forEach(cv => newSelectedCVs.delete(cv.id));
      setSelectedCollections(prev => {
        const newSet = new Set(prev);
        newSet.delete(collectionId);
        return newSet;
      });
    }
    
    setSelectedCVs(newSelectedCVs);
  };

  const handleCollectionExpand = (collectionId: number) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
  };

  const handleJdFileUpload = async (file: File) => {
    setJdUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/utils/extract-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload and parse file');
      }
      
      const data = await response.json();
      setJdText(data.text || '');
      setJdFile(file);
      setJdTab(1); // Switch to text tab to show parsed content
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setJdUploading(false);
    }
  };

  const handleStartMatching = async () => {
    if (selectedCVs.size === 0) {
      setError('Please select at least one CV for matching');
      return;
    }

    if (!jdText.trim()) {
      setError('Please enter a job description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/matching/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cv_ids: Array.from(selectedCVs),
          job_description: jdText.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start matching process');
      }

      alert('Matching process started successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start matching');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && collections.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        CV Matching & Evaluation
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Select multiple collections and individual CVs for matching and evaluation
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Job Description Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="secondary" />
                Job Description
              </Typography>
              
              <Tabs value={jdTab} onChange={(_, v) => setJdTab(v)} sx={{ mb: 2 }}>
                <Tab label="Upload File" />
                <Tab label="Paste Text" />
              </Tabs>

              {jdTab === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    fullWidth
                    disabled={jdUploading}
                    sx={{ 
                      py: 2,
                      borderStyle: 'dashed',
                      '&:hover': {
                        borderStyle: 'dashed'
                      }
                    }}
                  >
                    {jdUploading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Uploading...
                      </>
                    ) : (
                      'Upload JD File (PDF, TXT, DOC)'
                    )}
                    <input 
                      hidden 
                      type="file" 
                      accept=".txt,.pdf,.doc,.docx,.rtf" 
                      onChange={e => e.target.files?.[0] && handleJdFileUpload(e.target.files[0])} 
                    />
                  </Button>
                  
                  {jdFile && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      File uploaded: {jdFile.name}
                    </Typography>
                  )}
                </Box>
              )}

              {jdTab === 1 && (
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  variant="outlined"
                  placeholder="Enter job description here or upload a file..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  sx={{ mt: 2 }}
                />
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Describe the job requirements, responsibilities, and qualifications
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* CV Collections Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderIcon color="primary" />
                CV Collections
              </Typography>
              
              {collections.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="text.secondary">
                    No collections found. Please create collections in the CV Management section first.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {collections.map((collection) => {
                    const isCollectionSelected = selectedCollections.has(collection.id);
                    const isExpanded = expandedCollections.has(collection.id);
                    const selectedCVsInCollection = collection.cvs.filter(cv => selectedCVs.has(cv.id));
                    const isAllCVsSelected = collection.cvs.length > 0 && selectedCVsInCollection.length === collection.cvs.length;
                    const isIndeterminate = selectedCVsInCollection.length > 0 && selectedCVsInCollection.length < collection.cvs.length;

                    return (
                      <Accordion 
                        key={collection.id}
                        expanded={isExpanded}
                        onChange={() => handleCollectionExpand(collection.id)}
                        sx={{ 
                          mb: 1,
                          '&:before': { display: 'none' },
                          border: isCollectionSelected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.grey[300]}`,
                          borderRadius: 1,
                          '&.Mui-expanded': {
                            margin: '8px 0'
                          }
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{ 
                            backgroundColor: isCollectionSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.04)
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                            <Checkbox
                              checked={isCollectionSelected}
                              indeterminate={isIndeterminate}
                              onChange={() => handleCollectionToggle(collection.id)}
                              onClick={(e) => e.stopPropagation()}
                              color="primary"
                            />
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: isCollectionSelected ? 600 : 400 }}>
                                {collection.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {collection.cvs.length} CVs • Created {formatDate(collection.created_at)}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${selectedCVsInCollection.length}/${collection.cvs.length}`}
                              color={isCollectionSelected ? "primary" : "default"}
                              size="small"
                              variant={isCollectionSelected ? "filled" : "outlined"}
                            />
                          </Box>
                        </AccordionSummary>
                        
                        <AccordionDetails sx={{ pt: 0 }}>
                          {collection.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {collection.description}
                            </Typography>
                          )}
                          
                          <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={isAllCVsSelected}
                                  indeterminate={isIndeterminate}
                                  onChange={(e) => handleSelectAllCVsInCollection(collection.id, e.target.checked)}
                                  color="primary"
                                />
                              }
                              label={`Select all CVs in "${collection.name}"`}
                            />
                          </Box>
                          
                          <Divider sx={{ my: 1 }} />
                          
                          <List dense>
                            {collection.cvs.map((cv) => (
                              <ListItem key={cv.id} sx={{ pl: 4 }}>
                                <Checkbox
                                  checked={selectedCVs.has(cv.id)}
                                  onChange={() => handleCVToggle(cv.id)}
                                  color="primary"
                                  size="small"
                                />
                                <ListItemText
                                  primary={
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {cv.parsed_metadata?.full_name || cv.filename}
                                      </Typography>
                                      {cv.parsed_metadata?.current_position && (
                                        <Typography variant="caption" color="text.secondary">
                                          {cv.parsed_metadata.current_position}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                  secondary={`Uploaded: ${formatDate(cv.uploaded_at)}`}
                                />
                                <ListItemSecondaryAction>
                                  <Tooltip title="View CV details">
                                    <IconButton size="small">
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </ListItemSecondaryAction>
                              </ListItem>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {selectedCollections.size} collection(s) • {selectedCVs.size} CV(s) selected
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => {
              setSelectedCollections(new Set());
              setSelectedCVs(new Set());
            }}
          >
            Clear All
          </Button>
          <Button
            variant="contained"
            onClick={handleStartMatching}
            disabled={selectedCVs.size === 0 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
          >
            {loading ? 'Starting...' : 'Start Matching'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MatchingPage; 