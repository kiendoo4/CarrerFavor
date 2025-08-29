import React, { useState, useEffect } from 'react'
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  LinearProgress, 
  Stack, 
  TextField, 
  Typography,
  Grid,
  Tabs,
  Tab,
  Chip,
  Alert,
  Fade,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material'
import { 
  CloudUpload, 
  Assessment, 
  Description, 
  Work,
  CheckCircle,
  TrendingUp,
  FolderOpen
} from '@mui/icons-material'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface CV {
  id: number;
  filename: string;
  content: string;
  uploaded_at: string;
  parsed_metadata?: any;
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

export const CandidatePage: React.FC = () => {
  const { token, user } = useAuth()
  const [cvText, setCvText] = useState('')
  const [jdText, setJdText] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [cvTab, setCvTab] = useState(0)
  const [jdTab, setJdTab] = useState(0)
  const [cvs, setCvs] = useState<CV[]>([])
  const [collections, setCollections] = useState<CVCollection[]>([])
  const [loadingCvs, setLoadingCvs] = useState(false)
  const [selectedCvId, setSelectedCvId] = useState<number | null>(null)
  const [selectedJdId, setSelectedJdId] = useState<number | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null)

  // Fetch CVs and Collections for HR users
  const fetchCVs = async () => {
    if (user?.role !== 'hr') return
    
    setLoadingCvs(true)
    try {
      const params = selectedCollection ? { collection_id: selectedCollection } : {}
      const response = await axios.get(`${API}/cv/list`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      setCvs(response.data.cvs)
    } catch (err) {
      console.error('Error fetching CVs:', err)
    } finally {
      setLoadingCvs(false)
    }
  }

  const fetchCollections = async () => {
    if (user?.role !== 'hr') return
    
    try {
      const response = await axios.get(`${API}/cv/collections`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCollections(response.data.collections)
    } catch (err) {
      console.error('Error fetching collections:', err)
    }
  }

  useEffect(() => {
    fetchCVs()
    fetchCollections()
  }, [user, selectedCollection])

  const onCompute = async () => {
    if (!cvText.trim() || !jdText.trim()) {
      return
    }
    
    setLoading(true)
    try {
      const { data } = await axios.post(`${API}/match/single`, { cv_text: cvText, jd_text: jdText }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setScore(data.score)
    } finally {
      setLoading(false)
    }
  }

  const onUploadCvFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${API}/utils/extract-text`, form, { headers: { Authorization: `Bearer ${token}` } })
    setCvText(data.text || '')
  }

  const onUploadJdFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${API}/utils/extract-text`, form, { headers: { Authorization: `Bearer ${token}` } })
    setJdText(data.text || '')
  }

  const onSelectCv = async (cvId: number) => {
    try {
      const response = await axios.get(`${API}/cv/${cvId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCvText(response.data.content || '')
      setSelectedCvId(cvId)
    } catch (err) {
      console.error('Error fetching CV content:', err)
    }
  }

  const onSelectJd = async (cvId: number) => {
    try {
      const response = await axios.get(`${API}/cv/${cvId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setJdText(response.data.content || '')
      setSelectedJdId(cvId)
    } catch (err) {
      console.error('Error fetching JD content:', err)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'success'
    if (score >= 0.4) return 'warning'
    return 'error'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent Match'
    if (score >= 0.6) return 'Good Match'
    if (score >= 0.4) return 'Fair Match'
    return 'Poor Match'
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        CV-Job Matching
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Upload your CV and a job description to see how well they match
      </Typography>

      <Grid container spacing={3}>
        {/* CV Upload Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Description color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Your CV
                </Typography>
              </Stack>
              
              <Tabs value={cvTab} onChange={(_, v) => setCvTab(v)} sx={{ mb: 2 }}>
                <Tab label="Upload File" />
                <Tab label="Paste Text" />
              </Tabs>

              {cvTab === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    fullWidth
                    sx={{ 
                      py: 2,
                      borderStyle: 'dashed',
                      '&:hover': {
                        borderStyle: 'dashed'
                      }
                    }}
                  >
                    Upload CV File (PDF, TXT, DOC)
                    <input 
                      hidden 
                      type="file" 
                      accept=".txt,.pdf,.doc,.docx,.rtf" 
                      onChange={e => e.target.files?.[0] && onUploadCvFile(e.target.files[0])} 
                    />
                  </Button>
                </Box>
              )}

              <TextField
                label={cvTab === 0 ? "Extracted CV Text" : "Paste your CV content here"}
                value={cvText}
                onChange={e => setCvText(e.target.value)}
                multiline
                rows={8}
                fullWidth
                variant="outlined"
                placeholder="Your CV content will appear here..."
              />
              
              {cvText && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${cvText.length} characters`}
                  color="success"
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Job Description Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Work color="secondary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Job Description
                </Typography>
              </Stack>
              
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
                    sx={{ 
                      py: 2,
                      borderStyle: 'dashed',
                      '&:hover': {
                        borderStyle: 'dashed'
                      }
                    }}
                  >
                    Upload Job Description File
                    <input 
                      hidden 
                      type="file" 
                      accept=".txt,.pdf,.doc,.docx,.rtf" 
                      onChange={e => e.target.files?.[0] && onUploadJdFile(e.target.files[0])} 
                    />
                  </Button>
                </Box>
              )}

              <TextField
                label={jdTab === 0 ? "Extracted JD Text" : "Paste job description here"}
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                multiline
                rows={8}
                fullWidth
                variant="outlined"
                placeholder="Job description content will appear here..."
              />
              
              {jdText && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${jdText.length} characters`}
                  color="success"
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <Assessment color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Match Analysis
                </Typography>
              </Stack>

              <Button
                variant="contained"
                onClick={onCompute}
                disabled={!cvText.trim() || !jdText.trim() || loading}
                startIcon={<TrendingUp />}
                size="large"
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
                  },
                  '&:disabled': {
                    background: '#e5e7eb',
                    color: '#9ca3af'
                  }
                }}
              >
                {loading ? 'Analyzing...' : 'Analyze Match'}
              </Button>

              {loading && (
                <Box sx={{ mt: 3 }}>
                  <LinearProgress 
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                      }
                    }} 
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    Processing your CV and job description...
                  </Typography>
                </Box>
              )}

              {score !== null && !loading && (
                <Fade in timeout={500}>
                  <Paper 
                    elevation={0}
                    sx={{ 
                      mt: 3, 
                      p: 3, 
                      bgcolor: 'background.default',
                      border: `2px solid ${getScoreColor(score) === 'success' ? '#10b981' : getScoreColor(score) === 'warning' ? '#f59e0b' : '#ef4444'}`,
                      borderRadius: 2
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Match Score
                      </Typography>
                      <Chip
                        label={getScoreLabel(score)}
                        color={getScoreColor(score) as any}
                        sx={{ fontWeight: 600 }}
                      />
                    </Stack>
                    
                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Similarity Score
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {(score * 100).toFixed(1)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={score * 100}
                        sx={{
                          height: 12,
                          borderRadius: 6,
                          bgcolor: '#e5e7eb',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 6,
                            bgcolor: getScoreColor(score) === 'success' ? '#10b981' : getScoreColor(score) === 'warning' ? '#f59e0b' : '#ef4444'
                          }
                        }}
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="body2" color="text.secondary">
                      This score represents how well your CV matches the job requirements based on text similarity analysis.
                      {score >= 0.7 && " Excellent! Your profile aligns very well with this position."}
                      {score >= 0.4 && score < 0.7 && " Good match! Consider highlighting relevant skills more prominently."}
                      {score < 0.4 && " Consider updating your CV to better match the job requirements."}
                    </Typography>
                  </Paper>
                </Fade>
              )}

              {!cvText.trim() || !jdText.trim() ? (
                <Alert severity="info" sx={{ mt: 3 }}>
                  Please provide both your CV and the job description to analyze the match.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}