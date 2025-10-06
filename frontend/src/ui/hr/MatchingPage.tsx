import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
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
  Stack,
  LinearProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  TableCell
} from '@mui/material';
import {
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  CloudUpload,
  AutoFixHigh as AutoFixHighIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';
import { useAppState } from '../context/AppStateContext';
import * as docx from 'docx-preview';

// File Viewer Component for CV viewing (same as CV Management)
const FileViewer: React.FC<{ cv: CV; token: string | null }> = ({ cv, token }) => {
  const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const [fileError, setFileError] = React.useState<string | null>(null);
  const viewerRef = React.useRef<HTMLDivElement | null>(null);
  const [loadingDocx, setLoadingDocx] = React.useState(false);
  const [anonOpen, setAnonOpen] = React.useState(false);
  const [anonLoading, setAnonLoading] = React.useState(false);
  const [anonText, setAnonText] = React.useState('');
  
  const fetchAnonymized = async () => {
    try {
      setAnonLoading(true);
      const res = await fetch(`${API}/cv/${cv.id}/content/anonymized`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAnonText(data.content || '');
      setAnonOpen(true);
    } catch (e) {
      setAnonText('Failed to fetch anonymized content');
      setAnonOpen(true);
    } finally {
      setAnonLoading(false);
    }
  };

  // For PDF files, try to use iframe
  if (cv.filename.toLowerCase().endsWith('.pdf')) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'grey.300', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            PDF Viewer (if available)
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <Button size="small" variant="outlined" onClick={fetchAnonymized} disabled={anonLoading}>
              {anonLoading ? 'Loading...' : 'View anonymized text'}
            </Button>
          </Box>
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
        <Dialog open={anonOpen} onClose={() => setAnonOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>Anonymized Text</DialogTitle>
          <DialogContent>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>{anonText}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAnonOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
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
          if (!response.ok) throw new Error('Failed to fetch docx data');
          const arrayBuffer = await response.arrayBuffer();
          if (cancelled) return;
          if (viewerRef.current) {
            viewerRef.current.innerHTML = '';
            await docx.renderAsync(arrayBuffer, viewerRef.current);
          }
        } catch (e) {
          if (!cancelled && viewerRef.current) {
            viewerRef.current.innerHTML = `<p>Error loading DOCX: ${e instanceof Error ? e.message : 'Unknown error'}</p>`;
          }
        } finally {
          if (!cancelled) setLoadingDocx(false);
        }
      };
      loadDocx();
      return () => { cancelled = true; };
    }, [cv.id]);

    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'grey.300', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            DOCX Viewer
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <Button size="small" variant="outlined" onClick={fetchAnonymized} disabled={anonLoading}>
              {anonLoading ? 'Loading...' : 'View anonymized text'}
            </Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {loadingDocx ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <div ref={viewerRef} style={{ height: '100%' }} />
          )}
        </Box>
        <Dialog open={anonOpen} onClose={() => setAnonOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>Anonymized Text</DialogTitle>
          <DialogContent>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>{anonText}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAnonOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Fallback for other file types
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'grey.300', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          File Viewer
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <Button size="small" variant="outlined" onClick={fetchAnonymized} disabled={anonLoading}>
            {anonLoading ? 'Loading...' : 'View anonymized text'}
          </Button>
        </Box>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          File type not supported for preview
        </Typography>
      </Box>
      <Dialog open={anonOpen} onClose={() => setAnonOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Anonymized Text</DialogTitle>
        <DialogContent>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>{anonText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnonOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

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

interface MatchItem {
  cv_id: number;
  filename: string;
  score: number;
  anonymized_cv_text?: string;
  anonymized_jd_text?: string;
  detailed_scores?: Record<string, number>;
}

interface MatchResponse {
  results: MatchItem[];
}

const MatchingPage: React.FC = () => {
  const { token, user } = useAuth();
  const theme = useTheme();
  const { jdText, setJdText, error, setError } = useAppState();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<number>>(new Set());
  const [selectedCVs, setSelectedCVs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(new Set());
  const [jdTab, setJdTab] = useState(0);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdUploading, setJdUploading] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchItem[] | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MatchItem | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [enhancedCvLoading, setEnhancedCvLoading] = useState(false);
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false);
  const [enhancedPdfUrl, setEnhancedPdfUrl] = useState<string | null>(null);
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<any | null>(null);
  const [selectedCVForView, setSelectedCVForView] = useState<CV | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const exportToXLSX = () => {
    if (!matchResults || matchResults.length === 0) {
      setError('No results to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Filename',
      'Fit Score (%)',
      'ATS Score',
      'Recommend',
      'Strengths',
      'Weaknesses',
      'Edit Suggestions',
      'ATS Keywords',
      'ATS Formatting',
      'ATS Completeness',
      'Decision Rationale',
      'Counterfactuals'
    ];

    const csvContent = [
      headers.join(','),
      ...matchResults.map(item => {
        const analysis = (item.detailed_scores as any)?.analysis;
        return [
          `"${item.filename}"`,
          (item.score * 100).toFixed(1),
          analysis?.ats_check?.score || 'N/A',
          analysis?.recommendation || 'N/A',
          `"${(analysis?.strengths || []).join('; ')}"`,
          `"${(analysis?.weaknesses || []).join('; ')}"`,
          `"${(analysis?.edit_suggestions || []).join('; ')}"`,
          `"${analysis?.ats_check?.Keywords || 'N/A'}"`,
          `"${analysis?.ats_check?.Formatting || 'N/A'}"`,
          `"${analysis?.ats_check?.Completeness || 'N/A'}"`,
          `"${(analysis?.decision_rationale?.main_reasons || []).join('; ')}"`,
          `"${(analysis?.counterfactuals || []).map((cf: any) => cf.requirement).join('; ')}"`
        ].join(',');
      })
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `matching_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      const response = await fetch(`${API_BASE}/match/hr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cv_ids: Array.from(selectedCVs),
          jd_text: jdText.trim()
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to start matching process');
      }

      const data: MatchResponse = await response.json();
      setMatchResults((data?.results || []).sort((a, b) => b.score - a.score));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start matching');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEnhancedCV = async (cvText: string) => {
    if (!cvText.trim() || !jdText.trim()) {
      setError('Please provide both CV and Job Description text');
      return;
    }

    setEnhancedCvLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/match/enhance-cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cv_text: cvText,
          jd_text: jdText
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to generate enhanced CV');
      }
      const data = await response.json();
      if (data?.pdf_base64) {
        const binary = atob(data.pdf_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        setEnhancedPdfUrl(url);
        if (data.analysis) {
          setEnhancedAnalysis(data.analysis.analysis || data.analysis);
        }
        setShowEnhancedDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate enhanced CV');
    } finally {
      setEnhancedCvLoading(false);
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

  if (user && user.role !== 'hr') {
    return <Navigate to="/candidate" replace />
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
        <Grid item xs={12} md={6} order={{ xs: 2, md: 2 }}>
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
        <Grid item xs={12} md={6} order={{ xs: 1, md: 1 }}>
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
                          
                          {/* Removed select-all control; per-collection checkbox already handles this */}
                          
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
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title="View CV details">
                                      <IconButton 
                                        size="small"
                                        onClick={() => {
                                          setSelectedCVForView(cv);
                                          setShowViewDialog(true);
                                        }}
                                      >
                                        <InfoIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
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

      {/* Matching Results */}
      {matchResults && (
        <Box mt={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon color="success" />
                  Matching Results
                </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip label={`${matchResults.length} result(s)`} size="small" color="success" variant="outlined" />
              </Stack>
              </Stack>

              {matchResults.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No results.</Typography>
              ) : (
                <List>
                  {matchResults.map((item, idx) => {
                    const percent = Math.max(0, Math.min(100, Math.round(item.score * 100)));
                    const initials = (item.filename || 'CV').slice(0, 2).toUpperCase();
                    return (
                      <ListItem key={`${item.cv_id}-${idx}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                          <Chip label={`#${idx + 1}`} color={idx === 0 ? 'success' : 'default'} size="small" />
                          <Avatar sx={{ bgcolor: idx === 0 ? 'success.main' : 'primary.main', width: 32, height: 32, fontSize: 14 }}>
                            {initials}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="body1" sx={{ fontWeight: idx === 0 ? 600 : 500, mr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.filename}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={`Fit: ${(item.score * 100).toFixed(1)}%`} size="small" color={idx === 0 ? 'success' : 'default'} />
                                <Chip label={`ATS: ${typeof (item.detailed_scores as any)?.analysis?.ats_check?.score === 'number' ? Number((item.detailed_scores as any).analysis.ats_check.score).toFixed(0) + ' / 100' : '-'}`} size="small" color="info" />
                                {((item.detailed_scores as any)?.analysis?.recommendation) && (
                                  <Chip label={(item.detailed_scores as any).analysis.recommendation} size="small" color={(item.detailed_scores as any).analysis.recommendation === 'yes' ? 'success' : 'default'} />
                                )}
                              </Stack>
                            </Stack>
                            <LinearProgress variant="determinate" value={percent} sx={{ mt: 1, height: 8, borderRadius: 1 }} />
                          </Box>
                          <Tooltip title="View detailed analysis">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedResult(item);
                                setShowDetailsDialog(true);
                              }}
                              sx={{ 
                                color: 'primary.main',
                                '&:hover': { 
                                  bgcolor: 'primary.light',
                                  color: 'primary.contrastText'
                                }
                              }}
                            >
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

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
            variant="outlined"
            onClick={handleStartMatching}
            disabled={selectedCVs.size === 0 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
          >
            {loading ? 'Starting...' : 'Start Matching'}
          </Button>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<FileDownloadIcon />}
            onClick={exportToXLSX}
            disabled={!matchResults || matchResults.length === 0}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Detailed Results Dialog */}
      <Dialog 
        open={showDetailsDialog} 
        onClose={() => setShowDetailsDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Detailed Match Analysis - {selectedResult?.filename}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedResult && (
            <Stack spacing={3}>
              {/* Overall Score */}
              <Stack direction="row" spacing={2} justifyContent="center">
                <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 2, minWidth: 220, textAlign: 'center' }}>
                  <Typography variant="overline" sx={{ color: 'primary.contrastText', letterSpacing: 1 }}>FIT SCORE</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.contrastText' }}>
                    {(selectedResult.score * 100).toFixed(1)}%
                  </Typography>
                </Box>
                {typeof (selectedResult.detailed_scores as any)?.analysis?.ats_check?.score === 'number' && (
                  <Box sx={{ p: 2, bgcolor: 'info.main', borderRadius: 2, minWidth: 220, textAlign: 'center' }}>
                    <Typography variant="overline" sx={{ color: 'info.contrastText', letterSpacing: 1 }}>ATS SCORE</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.contrastText' }}>
                      {Number((selectedResult.detailed_scores as any).analysis.ats_check.score).toFixed(0)} / 100
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Detailed Scores */}
              {selectedResult.detailed_scores && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Detailed Scoring Breakdown
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {Object.entries(selectedResult.detailed_scores)
                        .filter(([key, value]) => key !== 'score' && typeof value === 'number')
                        .map(([key, value]) => (
                        <Grid item xs={6} sm={4} key={key}>
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                              {(() => {
                                const map: Record<string, string> = {
                                  s_must: 'Must-have coverage',
                                  s_nice: 'Nice-to-have coverage',
                                  s_skills: 'Skills balance',
                                  s_experience: 'Experience match',
                                  s_education: 'Education match',
                                  s_languages: 'Languages match',
                                  score: 'Relevance score'
                                };
                                return map[key] || key.replace(/_/g, ' ');
                              })()}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {typeof value === 'number' ? (value * 100).toFixed(1) + '%' : String(value)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Analysis */}
              {selectedResult.detailed_scores && (selectedResult.detailed_scores as any).analysis && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Detailed Analysis
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {(selectedResult.detailed_scores as any).analysis.recommendation && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Recommendation</Typography>
                          <Chip label={(selectedResult.detailed_scores as any).analysis.recommendation} color={(selectedResult.detailed_scores as any).analysis.recommendation === 'yes' ? 'success' : 'default'} />
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.decision_rationale && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Decision Rationale</Typography>
                          {(selectedResult.detailed_scores as any).analysis.decision_rationale.main_reasons && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Main reasons</Typography>
                              <Stack spacing={0.5}>
                                {(selectedResult.detailed_scores as any).analysis.decision_rationale.main_reasons.map((s: string, idx: number) => (
                                  <Typography key={idx} variant="body2">• {s}</Typography>
                                ))}
                              </Stack>
                            </Box>
                          )}
                          {(selectedResult.detailed_scores as any).analysis.decision_rationale.key_missing_factors && (
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Key missing factors</Typography>
                              <Stack spacing={0.5}>
                                {(selectedResult.detailed_scores as any).analysis.decision_rationale.key_missing_factors.map((s: string, idx: number) => (
                                  <Typography key={idx} variant="body2">• {s}</Typography>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.strengths && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Strengths</Typography>
                          <Stack direction="row" flexWrap="wrap" gap={1}>
                            {(selectedResult.detailed_scores as any).analysis.strengths.map((s: string, idx: number) => (
                              <Chip key={idx} label={s} variant="outlined" />
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.weaknesses && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Weaknesses</Typography>
                          <Stack direction="row" flexWrap="wrap" gap={1}>
                            {(selectedResult.detailed_scores as any).analysis.weaknesses.map((s: string, idx: number) => (
                              <Chip key={idx} color="warning" label={s} variant="outlined" />
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.edit_suggestions && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Edit Suggestions</Typography>
                          <Stack spacing={0.5}>
                            {(selectedResult.detailed_scores as any).analysis.edit_suggestions.map((s: string, idx: number) => (
                              <Typography key={idx} variant="body2">• {s}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.ats_check && (
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>ATS Check</Typography>
                          <Typography variant="body2">Keywords: {(selectedResult.detailed_scores as any).analysis.ats_check.Keywords}</Typography>
                          <Typography variant="body2">Formatting: {(selectedResult.detailed_scores as any).analysis.ats_check.Formatting}</Typography>
                          <Typography variant="body2">Completeness: {(selectedResult.detailed_scores as any).analysis.ats_check.Completeness}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>Score: {(selectedResult.detailed_scores as any).analysis.ats_check.score} / 100</Typography>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.counterfactuals && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Counterfactuals</Typography>
                          <Stack spacing={1}>
                            {(selectedResult.detailed_scores as any).analysis.counterfactuals.map((c: any, idx: number) => (
                              <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.requirement}</Typography>
                                <Typography variant="body2">Suggested: {c.suggested_change}</Typography>
                                {'predicted_score_delta' in c && (
                                  <Typography variant="body2">Δ Score: {c.predicted_score_delta}</Typography>
                                )}
                              </Paper>
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.contrastive_explanations && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Contrastive Explanations</Typography>
                          <Stack spacing={0.5}>
                            {(selectedResult.detailed_scores as any).analysis.contrastive_explanations.map((s: string, idx: number) => (
                              <Typography key={idx} variant="body2">• {s}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {(selectedResult.detailed_scores as any).analysis.decision_path && (
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Decision Path</Typography>
                          <Stack spacing={0.5}>
                            {(selectedResult.detailed_scores as any).analysis.decision_path.map((s: string, idx: number) => (
                              <Typography key={idx} variant="body2">• {s}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Anonymized CV Text */}
              {selectedResult.anonymized_cv_text && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      CV Content
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                      <Typography 
                        component="pre" 
                        sx={{ 
                          whiteSpace: 'pre-wrap', 
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          lineHeight: 1.5
                        }}
                      >
                        {selectedResult.anonymized_cv_text}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Anonymized JD Text */}
              {selectedResult.anonymized_jd_text && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Job Description
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                      <Typography 
                        component="pre" 
                        sx={{ 
                          whiteSpace: 'pre-wrap', 
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          lineHeight: 1.5
                        }}
                      >
                        {selectedResult.anonymized_jd_text}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Box sx={{ flex: 1 }} />
          {selectedResult?.detailed_scores?.analysis && (
            <Button 
              variant="outlined"
              onClick={() => {
                if (selectedResult?.anonymized_cv_text) {
                  handleGenerateEnhancedCV(selectedResult.anonymized_cv_text);
                }
              }}
              disabled={enhancedCvLoading || !selectedResult?.anonymized_cv_text}
              startIcon={enhancedCvLoading ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            >
              {enhancedCvLoading ? 'Enhancing...' : 'Enhance CV'}
            </Button>
          )}
          <Button variant="outlined" onClick={() => setShowDetailsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced CV Preview Dialog */}
      <Dialog 
        open={showEnhancedDialog} 
        onClose={() => {
          setShowEnhancedDialog(false);
          if (enhancedPdfUrl) {
            window.URL.revokeObjectURL(enhancedPdfUrl);
            setEnhancedPdfUrl(null);
          }
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Enhanced CV</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Box sx={{ height: { xs: 400, md: 600 } }}>
                {enhancedPdfUrl ? (
                  <iframe src={enhancedPdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Enhanced CV" />
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>No preview available</Box>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Paper sx={{ p: 2, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Fit Score</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      { (() => {
                        const s = (enhancedAnalysis as any)?.score ?? (selectedResult as any)?.detailed_scores?.analysis?.score ?? (selectedResult ? selectedResult.score : null);
                        if (s == null) return '—';
                        const val = typeof s === 'number' ? s : Number(s);
                        const pct = val > 1 ? val : val * 100;
                        return `${pct.toFixed(1)}%`;
                      })() }
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">ATS Score</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {(enhancedAnalysis as any)?.analysis?.ats_check?.score ?? (enhancedAnalysis as any)?.ats_check?.score ?? (selectedResult as any)?.detailed_scores?.analysis?.ats_check?.score ?? '—'}
                    </Typography>
                  </Paper>
                </Box>

                {(selectedResult as any)?.detailed_scores?.analysis && (
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Detailed Match Analysis</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        {(selectedResult as any).detailed_scores.analysis?.recommendation && (
                          <Typography variant="body2"><strong>Recommendation:</strong> {(selectedResult as any).detailed_scores.analysis.recommendation}</Typography>
                        )}
                        {(selectedResult as any).detailed_scores.analysis?.decision_rationale?.main_reasons?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Main reasons</Typography>
                            <List dense>
                              {(selectedResult as any).detailed_scores.analysis.decision_rationale.main_reasons.map((r: string, idx: number) => (
                                <ListItem key={idx}><ListItemText primary={r} /></ListItem>
                              ))}
                            </List>
                          </>
                        )}
                        {(selectedResult as any).detailed_scores.analysis?.strengths?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Strengths</Typography>
                            <List dense>
                              {(selectedResult as any).detailed_scores.analysis.strengths.map((r: string, idx: number) => (
                                <ListItem key={idx}><ListItemText primary={r} /></ListItem>
                              ))}
                            </List>
                          </>
                        )}
                        {(selectedResult as any).detailed_scores.analysis?.weaknesses?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Weaknesses</Typography>
                            <List dense>
                              {(selectedResult as any).detailed_scores.analysis.weaknesses.map((r: string, idx: number) => (
                                <ListItem key={idx}><ListItemText primary={r} /></ListItem>
                              ))}
                            </List>
                          </>
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  {enhancedPdfUrl && (
                    <Button variant="outlined" onClick={() => {
                      const link = document.createElement('a');
                      link.href = enhancedPdfUrl;
                      link.setAttribute('download', 'enhanced_cv.pdf');
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}>Download PDF</Button>
                  )}
                  <Button variant="outlined" onClick={() => {
                    setShowEnhancedDialog(false);
                    if (enhancedPdfUrl) {
                      window.URL.revokeObjectURL(enhancedPdfUrl);
                      setEnhancedPdfUrl(null);
                    }
                  }}>Close</Button>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
      {/* View CV Details Dialog */}
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
              <DescriptionIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CV Content - {selectedCVForView?.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded {selectedCVForView && formatDate(selectedCVForView.uploaded_at)}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, p: 0 }}>
          <Box sx={{ 
            height: '70vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedCVForView && (
              <FileViewer cv={selectedCVForView} token={token} />
            )}
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

    </Box>
  );
};

export default MatchingPage; 