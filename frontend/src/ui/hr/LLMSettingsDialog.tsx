import React, { useEffect, useState } from 'react'
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  MenuItem, 
  Stack,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Snackbar,
  Alert
} from '@mui/material'
import { ExpandMore, Psychology, AutoAwesome } from '@mui/icons-material'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type LLMProvider = 'openai' | 'gemini'

type Config = {
  // LLM Settings
  llm_provider: LLMProvider
  llm_api_key: string
  llm_model_name: string
  llm_temperature: number
  llm_top_p: number
  llm_max_tokens: number
}

const LLM_MODELS = {
  openai: [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ]
}


interface LLMSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: (config: Config) => Promise<void>;
  initialConfig?: Config | null;
}

export const LLMSettingsDialog: React.FC<LLMSettingsDialogProps> = ({ open, onClose, onSave, initialConfig }) => {
  const { token } = useAuth()
  const [cfg, setCfg] = useState<Config>({ 
    llm_provider: 'openai', 
    llm_api_key: '', 
    llm_model_name: 'gpt-4o-mini', 
    llm_temperature: 0.2, 
    llm_top_p: 1, 
    llm_max_tokens: 1024
  })
  const headers = { Authorization: `Bearer ${token}` }
  const [noti, setNoti] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' })
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialConfig) {
      setCfg(initialConfig)
    } else {
      axios.get(`${API}/llm/config`, { headers }).then(r => {
        setCfg(c => ({ ...c, ...r.data }))
      }).catch(() => {})
    }
  }, [open, initialConfig])

  const validateKey = async (kind: 'llm'): Promise<boolean> => {
    setValidating(true)
    try {
      const payload = {
        kind: 'llm',
        provider: cfg.llm_provider,
        api_key: cfg.llm_api_key,
        model_name: cfg.llm_model_name,
      }
      const { data } = await axios.post(`${API}/llm/validate-api-key`, payload, { headers })
      setNoti({ open: true, message: data.message, severity: data.valid ? 'success' : 'error' })
      return !!data.valid
    } catch (e: any) {
      setNoti({ open: true, message: e?.response?.data?.detail || 'Validation failed', severity: 'error' })
      return false
    } finally {
      setValidating(false)
    }
  }

  const save = async () => {
    try {
      // Validate LLM key first
      const llmOk = await validateKey('llm')
      if (!llmOk) return
      if (onSave) {
        await onSave(cfg)
      } else {
        await axios.post(`${API}/llm/config`, cfg, { headers })
      }
      setNoti({ open: true, message: 'Configuration saved successfully', severity: 'success' })
      onClose()
    } catch (error) {
      console.error('Failed to save config:', error)
      setNoti({ open: true, message: 'Failed to save configuration', severity: 'error' })
    }
  }

  const updateLLMProvider = (provider: LLMProvider) => {
    setCfg({
      ...cfg,
      llm_provider: provider,
      llm_model_name: LLM_MODELS[provider][0]
    })
  }

  

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Psychology color="primary" />
          <Typography variant="h6">AI Model Configuration</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* LLM Settings */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Psychology color="secondary" />
                <Typography variant="h6">LLM Settings</Typography>
                <Chip label="For CV Parsing" size="small" color="secondary" variant="outlined" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField 
                  select 
                  label="LLM Provider" 
                  value={cfg.llm_provider} 
                  onChange={e => updateLLMProvider(e.target.value as LLMProvider)}
                  fullWidth
                >
                  <MenuItem value="openai">OpenAI (GPT)</MenuItem>
                  <MenuItem value="gemini">Google Gemini</MenuItem>
                </TextField>
                
                <TextField 
                  label="API Key" 
                  type="password" 
                  value={cfg.llm_api_key} 
                  onChange={e => setCfg({ ...cfg, llm_api_key: e.target.value })} 
                  fullWidth 
                  placeholder={`Enter your ${cfg.llm_provider.toUpperCase()} API key`}
                />
                
                <TextField 
                  select 
                  label="Model" 
                  value={cfg.llm_model_name} 
                  onChange={e => setCfg({ ...cfg, llm_model_name: e.target.value })} 
                  fullWidth
                >
                  {LLM_MODELS[cfg.llm_provider].map(model => (
                    <MenuItem key={model} value={model}>{model}</MenuItem>
                  ))}
                </TextField>
                
                <Stack direction="row" spacing={2}>
                  <TextField 
                    label="Temperature" 
                    type="number" 
                    value={cfg.llm_temperature} 
                    onChange={e => setCfg({ ...cfg, llm_temperature: Number(e.target.value) })} 
                    inputProps={{ min: 0, max: 2, step: 0.1 }}
                    helperText="0-2, lower = more focused"
                  />
                  <TextField 
                    label="Top P" 
                    type="number" 
                    value={cfg.llm_top_p} 
                    onChange={e => setCfg({ ...cfg, llm_top_p: Number(e.target.value) })} 
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                    helperText="0-1, controls diversity"
                  />
                  <TextField 
                    label="Max Tokens" 
                    type="number" 
                    value={cfg.llm_max_tokens} 
                    onChange={e => setCfg({ ...cfg, llm_max_tokens: Number(e.target.value) })} 
                    inputProps={{ min: 100, max: 4000, step: 100 }}
                    helperText="Output length limit"
                  />
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>

          
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button 
          onClick={save} 
          variant="contained"
          sx={{
            background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
            }
          }}
          disabled={validating}
        >
          {validating ? 'Validating...' : 'Save Configuration'}
        </Button>
      </DialogActions>
      <Snackbar open={noti.open} autoHideDuration={4000} onClose={() => setNoti({ ...noti, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setNoti({ ...noti, open: false })} severity={noti.severity} sx={{ width: '100%' }}>
          {noti.message}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}