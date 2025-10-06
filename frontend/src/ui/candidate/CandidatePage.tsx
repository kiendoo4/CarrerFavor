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
  CircularProgress,
  IconButton,
  Tooltip,
  Avatar,
  alpha,
  useTheme
} from '@mui/material'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { 
  CloudUpload, 
  Assessment, 
  Description, 
  Work,
  CheckCircle,
  TrendingUp,
  FolderOpen,
  Visibility,
  Download,
  AutoFixHigh
} from '@mui/icons-material'
import { Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText } from '@mui/material'
import ExpandMore from '@mui/icons-material/ExpandMore'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'
import { useAppState } from '../context/AppStateContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// File Viewer Component for CV viewing
const FileViewer: React.FC<{ cvText: string }> = ({ cvText }) => {
  return (
    <Box sx={{ 
      height: '100%', 
      p: 3, 
      overflow: 'auto',
      bgcolor: 'background.default'
    }}>
      <Typography 
        component="pre" 
        sx={{ 
          whiteSpace: 'pre-wrap', 
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: 'text.primary'
        }}
      >
        {cvText}
      </Typography>
    </Box>
  )
}

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
  const theme = useTheme()
  const { 
    cvText, setCvText, 
    jdText, setJdText, 
    score, setScore, 
    loading, setLoading, 
    analysis, setAnalysis, 
    error, setError 
  } = useAppState()
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false)
  const [enhancedPdfUrl, setEnhancedPdfUrl] = useState<string | null>(null)
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<any | null>(null)
  const [enhancedCvLoading, setEnhancedCvLoading] = useState(false)
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
      const { data } = await axios.post(`${API}/match/single_detailed`, { cv_text: cvText, jd_text: jdText }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setScore(data.score)
      setAnalysis(data.analysis || null)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateEnhancedCV = async () => {
    if (!cvText.trim() || !jdText.trim()) {
      setError('Please provide both CV and Job Description text')
      return
    }

    setEnhancedCvLoading(true)
    try {
      const { data } = await axios.post(`${API}/match/enhance-cv`, {
        cv_text: cvText,
        jd_text: jdText
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (data?.pdf_base64) {
        const binary = atob(data.pdf_base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        setEnhancedPdfUrl(url)
      }
      if (data?.analysis) {
        setEnhancedAnalysis(data.analysis.analysis || data.analysis)
      }
      setShowEnhancedDialog(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate enhanced CV')
    } finally {
      setEnhancedCvLoading(false)
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

      {/* Analysis Dialog */}
      <Dialog open={showAnalysis} onClose={() => setShowAnalysis(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detailed Analysis</DialogTitle>
        <DialogContent>
          {analysis ? (
            <Stack spacing={2}>
              {analysis.recommendation && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Recommendation</Typography>
                  <Chip label={analysis.recommendation} color={analysis.recommendation === 'yes' ? 'success' : 'default'} />
                </Box>
              )}
              {analysis.decision_rationale && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Decision Rationale</Typography>
                  {analysis.decision_rationale.main_reasons && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Main reasons</Typography>
                      <Stack spacing={0.5}>
                        {analysis.decision_rationale.main_reasons.map((s: string, idx: number) => (
                          <Typography key={idx} variant="body2">• {s}</Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {analysis.decision_rationale.key_missing_factors && (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Key missing factors</Typography>
                      <Stack spacing={0.5}>
                        {analysis.decision_rationale.key_missing_factors.map((s: string, idx: number) => (
                          <Typography key={idx} variant="body2">• {s}</Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}
              {analysis.strengths && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Strengths</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {analysis.strengths.map((s: string, idx: number) => (
                      <Chip key={idx} label={s} variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}
              {analysis.weaknesses && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Weaknesses</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {analysis.weaknesses.map((s: string, idx: number) => (
                      <Chip key={idx} color="warning" label={s} variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}
              {analysis.edit_suggestions && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Edit Suggestions</Typography>
                  <Stack spacing={0.5}>
                    {analysis.edit_suggestions.map((s: string, idx: number) => (
                      <Typography key={idx} variant="body2">• {s}</Typography>
                    ))}
                  </Stack>
                </Box>
              )}
              {analysis.ats_check && (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>ATS Check</Typography>
                  <Typography variant="body2">Keywords: {analysis.ats_check.Keywords}</Typography>
                  <Typography variant="body2">Formatting: {analysis.ats_check.Formatting}</Typography>
                  <Typography variant="body2">Completeness: {analysis.ats_check.Completeness}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>Score: {analysis.ats_check.score}</Typography>
                </Box>
              )}
              {analysis.counterfactuals && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Counterfactuals</Typography>
                  <Stack spacing={1}>
                    {analysis.counterfactuals.map((c: any, idx: number) => (
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
              {analysis.contrastive_explanations && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Contrastive Explanations</Typography>
                  <Stack spacing={0.5}>
                    {analysis.contrastive_explanations.map((s: string, idx: number) => (
                      <Typography key={idx} variant="body2">• {s}</Typography>
                    ))}
                  </Stack>
                </Box>
              )}
              {analysis.decision_path && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Decision Path</Typography>
                  <Stack spacing={0.5}>
                    {analysis.decision_path.map((s: string, idx: number) => (
                      <Typography key={idx} variant="body2">• {s}</Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">No analysis available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalysis(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced CV Preview Dialog */}
      <Dialog 
        open={showEnhancedDialog} 
        onClose={() => {
          setShowEnhancedDialog(false)
          if (enhancedPdfUrl) {
            window.URL.revokeObjectURL(enhancedPdfUrl)
            setEnhancedPdfUrl(null)
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
                        const s = (enhancedAnalysis as any)?.score ?? (analysis as any)?.score ?? (score != null ? score : null)
                        if (s == null) return '—'
                        const val = typeof s === 'number' ? s : Number(s)
                        const pct = val > 1 ? val : val * 100
                        return `${pct.toFixed(1)}%`
                      })() }
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">ATS Score</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {(enhancedAnalysis as any)?.analysis?.ats_check?.score ?? (enhancedAnalysis as any)?.ats_check?.score ?? (analysis as any)?.analysis?.ats_check?.score ?? (analysis as any)?.ats_check?.score ?? '—'}
                    </Typography>
                  </Paper>
                </Box>

                {analysis && (
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Detailed Match Analysis</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        {analysis?.recommendation && (
                          <Typography variant="body2"><strong>Recommendation:</strong> {analysis.recommendation}</Typography>
                        )}
                        {analysis?.decision_rationale?.main_reasons?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Main reasons</Typography>
                            <List dense>
                              {analysis.decision_rationale.main_reasons.map((r: string, idx: number) => (
                                <ListItem key={idx}><ListItemText primary={r} /></ListItem>
                              ))}
                            </List>
                          </>
                        )}
                        {analysis?.strengths?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Strengths</Typography>
                            <List dense>
                              {analysis.strengths.map((r: string, idx: number) => (
                                <ListItem key={idx}><ListItemText primary={r} /></ListItem>
                              ))}
                            </List>
                          </>
                        )}
                        {analysis?.weaknesses?.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Weaknesses</Typography>
                            <List dense>
                              {analysis.weaknesses.map((r: string, idx: number) => (
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
                      const link = document.createElement('a')
                      link.href = enhancedPdfUrl
                      link.setAttribute('download', 'enhanced_cv.pdf')
                      document.body.appendChild(link)
                      link.click()
                      link.remove()
                    }}>Download PDF</Button>
                  )}
                  <Button variant="outlined" onClick={() => {
                    setShowEnhancedDialog(false)
                    if (enhancedPdfUrl) {
                      window.URL.revokeObjectURL(enhancedPdfUrl)
                      setEnhancedPdfUrl(null)
                    }
                  }}>Close</Button>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }} />
      </Dialog>
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
                variant="outlined"
                onClick={onCompute}
                disabled={!cvText.trim() || !jdText.trim() || loading}
                startIcon={<TrendingUp />}
                size="large"
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none'
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
                        Result
                      </Typography>
                      <Chip
                        label={getScoreLabel(score)}
                        color={getScoreColor(score) as any}
                        sx={{ fontWeight: 600 }}
                      />
                    </Stack>
                    
                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                        <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 2, minWidth: 220, textAlign: 'center' }}>
                          <Typography variant="overline" sx={{ letterSpacing: 1 }}>FIT SCORE</Typography>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {(score * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        {analysis?.ats_check?.score !== undefined && (
                          <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2, minWidth: 220, textAlign: 'center' }}>
                            <Typography variant="overline" sx={{ letterSpacing: 1 }}>ATS SCORE</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              {Number(analysis.ats_check.score).toFixed(0)} / 100
                            </Typography>
                          </Box>
                        )}
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
                      Fit Score represents how well your CV matches the job requirements.
                      {score >= 0.7 && " Excellent! Your profile aligns very well with this position."}
                      {score >= 0.4 && score < 0.7 && " Good match! Consider highlighting relevant skills more prominently."}
                      {score < 0.4 && " Consider updating your CV to better match the job requirements."}
                    </Typography>

                    {/* ATS score displayed alongside Fit above */}

                      {analysis && (
                        <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button 
                            variant="outlined" 
                            onClick={() => setShowViewDialog(true)}
                            startIcon={<Visibility />}
                          >
                            View CV Details
                          </Button>
                          <Button 
                            variant="outlined" 
                            onClick={() => setShowAnalysis(true)}
                            startIcon={<Assessment />}
                          >
                            View detailed analysis
                          </Button>
                          <Button 
                            variant="outlined" 
                            onClick={handleGenerateEnhancedCV}
                            disabled={enhancedCvLoading}
                            startIcon={enhancedCvLoading ? <CircularProgress size={16} /> : <AutoFixHigh />}
                          >
                            {enhancedCvLoading ? 'Enhancing...' : 'Enhance CV'}
                          </Button>
                        </Box>
                      )}
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
              <Description />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CV Content
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current CV text for analysis
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
            <FileViewer cvText={cvText} />
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
  )
}