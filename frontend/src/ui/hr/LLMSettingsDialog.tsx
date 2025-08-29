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
  Chip
} from '@mui/material'
import { ExpandMore, Psychology, AutoAwesome } from '@mui/icons-material'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type LLMProvider = 'openai' | 'gemini'
type EmbeddingProvider = 'local' | 'gemini' | 'openai'

type Config = {
  // LLM Settings
  llm_provider: LLMProvider
  llm_api_key: string
  llm_model_name: string
  llm_temperature: number
  llm_top_p: number
  llm_max_tokens: number
  
  // Embedding Settings
  embedding_provider: EmbeddingProvider
  embedding_api_key?: string
  embedding_model_name: string
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

const EMBEDDING_MODELS = {
  local: [
    'paraphrase-multilingual-MiniLM-L12-v2',
    'all-MiniLM-L6-v2',
    'all-mpnet-base-v2'
  ],
  openai: [
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-embedding-ada-002'
  ],
  gemini: [
    'models/text-embedding-004',
    'models/embedding-001'
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
    llm_max_tokens: 1024,
    embedding_provider: 'local',
    embedding_api_key: '',
    embedding_model_name: 'paraphrase-multilingual-MiniLM-L12-v2'
  })
  const headers = { Authorization: `Bearer ${token}` }

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

  const save = async () => {
    try {
      if (onSave) {
        await onSave(cfg)
      } else {
        await axios.post(`${API}/llm/config`, cfg, { headers })
      }
      onClose()
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const updateLLMProvider = (provider: LLMProvider) => {
    setCfg({
      ...cfg,
      llm_provider: provider,
      llm_model_name: LLM_MODELS[provider][0]
    })
  }

  const updateEmbeddingProvider = (provider: EmbeddingProvider) => {
    setCfg({
      ...cfg,
      embedding_provider: provider,
      embedding_model_name: EMBEDDING_MODELS[provider][0]
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

          {/* Embedding Settings */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoAwesome color="primary" />
                <Typography variant="h6">Embedding Settings</Typography>
                <Chip label="For Semantic Search" size="small" color="primary" variant="outlined" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField 
                  select 
                  label="Embedding Provider" 
                  value={cfg.embedding_provider} 
                  onChange={e => updateEmbeddingProvider(e.target.value as EmbeddingProvider)}
                  fullWidth
                >
                  <MenuItem value="local">
                    <Stack>
                      <Typography>Local (Sentence Transformers)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Free, runs locally, multilingual support
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="openai">
                    <Stack>
                      <Typography>OpenAI Embeddings</Typography>
                      <Typography variant="caption" color="text.secondary">
                        High quality, requires API key
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="gemini">
                    <Stack>
                      <Typography>Google Gemini Embeddings</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Google's embeddings, requires API key
                      </Typography>
                    </Stack>
                  </MenuItem>
                </TextField>

                {cfg.embedding_provider !== 'local' && (
                  <TextField 
                    label="Embedding API Key" 
                    type="password" 
                    value={cfg.embedding_api_key || ''} 
                    onChange={e => setCfg({ ...cfg, embedding_api_key: e.target.value })} 
                    fullWidth 
                    placeholder={`Enter your ${cfg.embedding_provider.toUpperCase()} API key`}
                  />
                )}
                
                <TextField 
                  select 
                  label="Embedding Model" 
                  value={cfg.embedding_model_name} 
                  onChange={e => setCfg({ ...cfg, embedding_model_name: e.target.value })} 
                  fullWidth
                >
                  {EMBEDDING_MODELS[cfg.embedding_provider].map(model => (
                    <MenuItem key={model} value={model}>
                      <Stack>
                        <Typography>{model}</Typography>
                        {cfg.embedding_provider === 'local' && model === 'paraphrase-multilingual-MiniLM-L12-v2' && (
                          <Typography variant="caption" color="primary">
                            ✨ Recommended: Best for multilingual CV matching
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
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
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  )
}