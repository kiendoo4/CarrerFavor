import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { appTheme } from './theme'
import { AuthProvider } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import { AppLayout } from './layout/AppLayout'
import { RequireAuth } from './auth/RequireAuth'
import { CandidatePage } from './candidate/CandidatePage'
import { HRPage } from './hr/HRPage'
import { CVManagementPage } from './hr/CVManagementPage'
import MatchingPage from './hr/MatchingPage'
import { EvaluationPage } from './hr/EvaluationPage'
import { UserSettingsPage } from './auth/UserSettingsPage'

export const App: React.FC = () => {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }>
              <Route index element={<Navigate to="candidate" replace />} />
              <Route path="candidate" element={<CandidatePage />} />
              <Route path="hr" element={<HRPage />} />
              <Route path="cv-management" element={<CVManagementPage />} />
              <Route path="matching" element={<MatchingPage />} />
              <Route path="evaluation" element={<EvaluationPage />} />
              <Route path="settings" element={<UserSettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

