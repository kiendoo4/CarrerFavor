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
  Person,
  Business,
  Folder,
  ExpandMore,
  Add as AddIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon,
  Analytics as AnalyticsIcon
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
  const [collections, setCollections] = useState<any[]>([])
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
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const { data } = await axios.get(`${API}/matching/collections`, { headers })
      setCollections(data || [])
    } catch (e) {
      console.error('Failed to load collections:', e)
    }
  }

  if (user?.role !== 'hr') {
    return <Alert severity="warning">This feature is only available for HR accounts.</Alert>
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Hero (text only) */}
      <Box sx={{ px: { xs: 1, md: 1 }, py: { xs: 2, md: 3 }, mb: 1 }}>
        <Typography
          variant="h1"
          sx={{
            fontWeight: 800,
            mb: 1,
            background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Welcome to CareerFavor
        </Typography>
        <Typography variant="h4" color="text.secondary">
          Your AI copilot for candidate screening and CV–JD matching
        </Typography>
      </Box>

      {/* Feature Cards */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Person color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Candidate</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For "Candidate" accounts. Evaluate how well a single CV fits a given Job Description (JD). View Fit Score, ATS Score, and a detailed analysis.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate('/candidate')}>Open</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Business color="success" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Matching</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For HR users. Run matching across multiple CVs against one JD, review ranked results, and open detailed analyses per candidate.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate('/matching')}>Open</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Folder color="secondary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>CV Management</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Manage CV collections: upload, view, and organize CVs to use in matching workflows.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate('/cv-management')}>Open</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Assessment color="info" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Evaluation</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For research purposes. Batch evaluate labeled datasets (CV/JD/label) to measure and compare model performance.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => navigate('/evaluation')}>Open</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}