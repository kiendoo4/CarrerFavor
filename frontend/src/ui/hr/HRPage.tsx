import React, { useEffect, useState } from 'react'
import { 
  Alert, 
  Box, 
  Button, 
  Card, 
  CardContent, 
  LinearProgress, 
  Stack, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow, 
  TextField, 
  Typography,
  Grid,
  Tabs,
  Tab,
  Chip,
  Paper,
  Divider,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import { 
  CloudUpload, 
  Settings, 
  Assessment, 
  Work,
  TrendingUp,
  Folder,
  ExpandMore
} from '@mui/icons-material'
import { LLMSettingsDialog } from './LLMSettingsDialog'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type CVRow = { id: number; filename: string }
type HRResult = { 
  cv_id: number; 
  filename: string; 
  score: number;
  anonymized_cv_text?: string;
  anonymized_jd_text?: string;
  detailed_scores?: Record<string, number>;
}

export const HRPage: React.FC = () => {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [jdText, setJdText] = useState('')
  const [cvs, setCvs] = useState<CVRow[]>([])
  const [results, setResults] = useState<HRResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jdTab, setJdTab] = useState(0)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedResult, setSelectedResult] = useState<HRResult | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  const loadCVs = async () => {
    try {
      // Use the new proper CV list endpoint
      const { data } = await axios.get(`${API}/cv/list`, { headers })
      setCvs(data.cvs.map((cv: any) => ({ id: cv.id, filename: cv.filename })))
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to list CVs')
    }
  }

  const compute = async () => {
    if (!jdText.trim()) {
      setError('Please provide a job description')
      return
    }
    
    if (cvs.length === 0) {
      setError('No CVs available. Please upload CVs first.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post(`${API}/match/hr`, { 
        cv_ids: cvs.map(c => c.id), 
        jd_text: jdText 
      }, { headers })
      setResults(data.results)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to compute matches')
    } finally {
      setLoading(false)
    }
  }

  const onUploadJdFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${API}/utils/extract-text`, form, { headers })
    setJdText(data.text || '')
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'success'
    if (score >= 0.4) return 'warning'
    return 'error'
  }

  useEffect(() => {
    loadCVs()
  }, [])

  if (user?.role !== 'hr') {
    return <Alert severity="warning">This feature is only available for HR accounts.</Alert>
  }

  return (
    <>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CV-Job Matching
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Compare job descriptions against your CV database
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Settings />}
              onClick={() => setSettingsOpen(true)}
              sx={{ height: 'fit-content' }}
            >
              Model Settings
            </Button>
          </Stack>
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

        <Grid container spacing={3}>
          {/* CV Summary */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Folder color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    CV Database
                  </Typography>
                </Stack>

                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                    {cvs.length}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    CVs available for matching
                  </Typography>
                  
                  <Button
                    variant="contained"
                    startIcon={<Folder />}
                    onClick={() => navigate('/cv-management')}
                    sx={{
                      background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
                      }
                    }}
                  >
                    Manage CVs
                  </Button>
                </Box>

                {cvs.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No CVs found. Upload CVs in the CV Management section first.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Job Description and Matching */}
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              {/* Job Description Card */}
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                    <Work color="secondary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Job Description
                    </Typography>
                  </Stack>

                  <Tabs value={jdTab} onChange={(_, v) => setJdTab(v)} sx={{ mb: 2 }}>
                    <Tab label="Paste Text" />
                    <Tab label="Upload File" />
                  </Tabs>

                  {jdTab === 1 && (
                    <Box sx={{ mb: 2 }}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUpload />}
                        fullWidth
                        sx={{ 
                          py: 1.5,
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
                    label={jdTab === 1 ? "Extracted JD Text" : "Paste job description here"}
                    value={jdText}
                    onChange={e => setJdText(e.target.value)}
                    multiline
                    rows={8}
                    fullWidth
                    placeholder="Enter the job description to match against CVs..."
                  />

                  <Button
                    variant="contained"
                    onClick={compute}
                    disabled={cvs.length === 0 || !jdText.trim() || loading}
                    startIcon={<TrendingUp />}
                    sx={{
                      mt: 2,
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
                    {loading ? 'Analyzing CVs...' : 'Find Best Matches'}
                  </Button>

                  {loading && (
                    <Box sx={{ mt: 2 }}>
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
                        Processing {cvs.length} CVs against job description...
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Results Card */}
              {results && !loading && (
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                      <Assessment color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Match Results
                      </Typography>
                      <Chip 
                        label={`${results.length} candidates ranked`} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    </Stack>

                    <Paper variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Rank</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Candidate CV</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Match Score</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Rating</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Details</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results
                            .sort((a, b) => b.score - a.score)
                            .map((result, index) => (
                            <TableRow key={result.cv_id} hover>
                              <TableCell>
                                <Chip
                                  label={`#${index + 1}`}
                                  size="small"
                                  color={index < 3 ? 'primary' : 'default'}
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {result.filename}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {(result.score * 100).toFixed(1)}%
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={
                                    result.score >= 0.8 ? 'Excellent' :
                                    result.score >= 0.6 ? 'Good' :
                                    result.score >= 0.4 ? 'Fair' : 'Poor'
                                  }
                                  color={getScoreColor(result.score) as any}
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    // Show detailed results in a dialog
                                    setSelectedResult(result);
                                    setShowDetailsDialog(true);
                                  }}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>

                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        💡 <strong>Tip:</strong> Scores above 70% indicate strong matches. 
                        Consider interviewing candidates with scores above 60% for best results.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      <LLMSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      
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
              <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.contrastText' }}>
                  {(selectedResult.score * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body1" color="primary.contrastText">
                  Overall Match Score
                </Typography>
              </Box>

              {/* Detailed Scores */}
              {selectedResult.detailed_scores && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Detailed Scoring Breakdown
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {Object.entries(selectedResult.detailed_scores).map(([key, value]) => (
                        <Grid item xs={6} sm={4} key={key}>
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                              {key.replace(/_/g, ' ')}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {(value * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Anonymized CV Text */}
              {selectedResult.anonymized_cv_text && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Anonymized CV Content
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
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Anonymized Job Description
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
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}