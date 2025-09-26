import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Stack,
  Divider,
  LinearProgress,
  CircularProgress,
  alpha,
  useTheme,
  IconButton
} from '@mui/material'
import {
  CloudUpload,
  Assessment,
  TrendingUp,
  Description,
  Work,
  Label,
  Analytics,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close,
  PlayArrow
} from '@mui/icons-material'
import { useAuth } from '../auth/AuthContext'
import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface ColumnMapping {
  cvTextColumn: string
  jdTextColumn: string
  labelColumn: string
}

interface LabelInfo {
  label: string
  count: number
}

interface LabelRule {
  label: string
  rule: string
}

interface EvaluationData {
  file: File
  columns: string[]
  columnMapping: ColumnMapping
  labelInfo: LabelInfo[]
  labelRules: LabelRule[]
  totalRows: number
}

export const EvaluationPage: React.FC = () => {
  const { token, user } = useAuth()
  const theme = useTheme()
  
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileColumns, setFileColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    cvTextColumn: '',
    jdTextColumn: '',
    labelColumn: ''
  })
  const [labelInfo, setLabelInfo] = useState<LabelInfo[]>([])
  const [labelRules, setLabelRules] = useState<LabelRule[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please upload a valid Excel (.xlsx, .xls) or CSV file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Send file to backend for parsing
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await axios.post(`${API}/evaluation/parse-file`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setFileColumns(response.data.columns)
      setTotalRows(response.data.total_rows)
      setSelectedFile(file)
      setShowColumnDialog(true)
    } catch (err: any) {
      setError('Failed to parse file: ' + (err.response?.data?.detail || err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }


  // Handle column mapping submission
  const handleColumnMapping = async () => {
    if (!columnMapping.cvTextColumn || !columnMapping.jdTextColumn || !columnMapping.labelColumn) {
      setError('Please select all three required columns')
      return
    }

    setLoading(true)
    try {
      // Send file to backend for label analysis
      const formData = new FormData()
      formData.append('file', selectedFile!)
      formData.append('label_column', columnMapping.labelColumn)
      
      const response = await axios.post(`${API}/evaluation/analyze-labels`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setLabelInfo(response.data.labels)
      setTotalRows(response.data.total_rows)
      setShowColumnDialog(false)
      setShowConfirmDialog(true)
    } catch (err: any) {
      setError('Failed to analyze labels: ' + (err.response?.data?.detail || err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }


  // Handle confirmation dialog
  const handleConfirmSetup = () => {
    // Initialize label rules with empty rules
    const rules = labelInfo.map(label => ({
      label: label.label,
      rule: ''
    }))
    setLabelRules(rules)
    setShowConfirmDialog(false)
    setSuccess('File uploaded and analyzed successfully!')
  }

  // Handle label rule change
  const handleLabelRuleChange = (label: string, rule: string) => {
    setLabelRules(prev => 
      prev.map(item => 
        item.label === label ? { ...item, rule } : item
      )
    )
  }

  // Handle start evaluation
  const handleStartEvaluation = async () => {
    // Check if all label rules are filled
    const emptyRules = labelRules.filter(rule => !rule.rule.trim())
    if (emptyRules.length > 0) {
      setError('Please fill in rules for all labels')
      return
    }

    setLoading(true)
    try {
      // Send evaluation request to backend
      const formData = new FormData()
      formData.append('file', selectedFile!)
      formData.append('cv_column', columnMapping.cvTextColumn)
      formData.append('jd_column', columnMapping.jdTextColumn)
      formData.append('label_column', columnMapping.labelColumn)
      formData.append('label_rules', JSON.stringify(labelRules))
      
      const response = await axios.post(`${API}/evaluation/start-evaluation`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setEvaluationData({
        file: selectedFile!,
        columns: fileColumns,
        columnMapping,
        labelInfo,
        labelRules,
        totalRows
      })
      setSuccess('Evaluation started successfully!')
    } catch (err: any) {
      setError('Failed to start evaluation: ' + (err.response?.data?.detail || err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Remove selected file
  const removeSelectedFile = () => {
    setSelectedFile(null)
    setFileColumns([])
    setColumnMapping({ cvTextColumn: '', jdTextColumn: '', labelColumn: '' })
    setLabelInfo([])
    setLabelRules([])
    setTotalRows(0)
    setEvaluationData(null)
  }

  // Check if evaluation can start
  const canStartEvaluation = () => {
    return selectedFile && 
           columnMapping.cvTextColumn && 
           columnMapping.jdTextColumn && 
           columnMapping.labelColumn &&
           labelRules.length > 0 &&
           labelRules.every(rule => rule.rule.trim())
  }

  if (user?.role !== 'hr') {
    return <Alert severity="warning">This feature is only available for HR accounts.</Alert>
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Workflow Evaluation
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Upload evaluation data and analyze matching effectiveness
      </Typography>

        {/* Notifications */}
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
          {/* Upload Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                  <CloudUpload color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Upload Evaluation Data
                  </Typography>
                </Stack>

                {!selectedFile ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      fullWidth
                      disabled={loading}
                      sx={{ 
                        py: 3,
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        '&:hover': {
                          borderStyle: 'dashed',
                          borderWidth: 2
                        }
                      }}
                    >
                      {loading ? (
                        <Stack alignItems="center" spacing={1}>
                          <CircularProgress size={24} />
                          <Typography variant="body2">Processing file...</Typography>
                        </Stack>
                      ) : (
                        'Upload Excel/CSV File'
                      )}
                      <input 
                        hidden 
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                      />
                    </Button>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Supported formats: Excel (.xlsx, .xls) and CSV files
                    </Typography>
                  </Box>
                ) : (
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Description color="primary" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedFile.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton 
                        size="small" 
                        onClick={removeSelectedFile}
                        color="error"
                      >
                        <Close />
                      </IconButton>
                    </Stack>
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Current Setup */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                  <Analytics color="secondary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Current Setup
                  </Typography>
                </Stack>

                {!selectedFile ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No evaluation data uploaded yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Upload a file to get started
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        File: {selectedFile.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        CV Column: {columnMapping.cvTextColumn || 'Not selected'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        JD Column: {columnMapping.jdTextColumn || 'Not selected'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Label Column: {columnMapping.labelColumn || 'Not selected'}
                      </Typography>
                      {totalRows > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Total Rows: {totalRows}
                        </Typography>
                      )}
                    </Box>
                    
                    {labelInfo.length > 0 && (
                      <>
                        <Divider />
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                            Detected Labels:
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {labelInfo.map((label, index) => (
                              <Chip 
                                key={index}
                                label={`${label.label} (${label.count})`} 
                                size="small"
                                color="primary" 
                                variant="outlined" 
                              />
                            ))}
                          </Stack>
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* CV-JD Matching Rules */}
          {labelInfo.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                    <Label color="warning" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Matching Rules
                    </Typography>
                  </Stack>

                  <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Define rules for each label to evaluate matching effectiveness:
                    </Typography>
                    
                    <Stack spacing={3}>
                      {labelInfo.map((label, index) => (
                        <Box key={index}>
                          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                            <Chip 
                              label={label.label} 
                              color="primary" 
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {label.count} samples
                            </Typography>
                          </Stack>
                          <TextField
                            fullWidth
                            placeholder={`Enter rule for ${label.label} (e.g., score >= 0.8)`}
                            value={labelRules.find(rule => rule.label === label.label)?.rule || ''}
                            onChange={(e) => handleLabelRuleChange(label.label, e.target.value)}
                            size="small"
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Bottom Start Evaluation Button */}
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={handleStartEvaluation}
                disabled={loading}
                sx={{
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
                  }
                }}
              >
                {loading ? 'Starting Evaluation...' : 'Start Evaluation'}
              </Button>
              {totalRows > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Ready to evaluate {totalRows} CV-JD pairs with {labelInfo.length} label types
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Column Mapping Dialog */}
      <Dialog 
        open={showColumnDialog} 
        onClose={() => setShowColumnDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Description color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Select Column Mapping
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please select which columns contain the CV text, JD text, and labels:
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>CV Text Column</InputLabel>
                <Select
                  value={columnMapping.cvTextColumn}
                  onChange={(e) => setColumnMapping({ ...columnMapping, cvTextColumn: e.target.value })}
                  label="CV Text Column"
                >
                  {fileColumns.map((column) => (
                    <MenuItem key={column} value={column}>{column}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>JD Text Column</InputLabel>
                <Select
                  value={columnMapping.jdTextColumn}
                  onChange={(e) => setColumnMapping({ ...columnMapping, jdTextColumn: e.target.value })}
                  label="JD Text Column"
                >
                  {fileColumns.map((column) => (
                    <MenuItem key={column} value={column}>{column}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Label Column</InputLabel>
                <Select
                  value={columnMapping.labelColumn}
                  onChange={(e) => setColumnMapping({ ...columnMapping, labelColumn: e.target.value })}
                  label="Label Column"
                >
                  {fileColumns.map((column) => (
                    <MenuItem key={column} value={column}>{column}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowColumnDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleColumnMapping}
            variant="contained"
            disabled={!columnMapping.cvTextColumn || !columnMapping.jdTextColumn || !columnMapping.labelColumn || loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Analyzing...' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog 
        open={showConfirmDialog} 
        onClose={() => setShowConfirmDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircle color="success" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              File Information
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Please review the detected labels and column mapping:
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Column Mapping:
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>CV Text:</strong> {columnMapping.cvTextColumn}
                  </Typography>
                  <Typography variant="body2">
                    <strong>JD Text:</strong> {columnMapping.jdTextColumn}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Label:</strong> {columnMapping.labelColumn}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Rows:</strong> {totalRows}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.secondary.main, 0.05) }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Detected Labels:
                </Typography>
                <Stack spacing={1}>
                  {labelInfo.map((label, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{label.label}</Typography>
                      <Chip label={label.count} size="small" color="primary" variant="outlined" />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmSetup}
            variant="contained"
            sx={{
              background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
              }
            }}
          >
            Confirm Setup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}