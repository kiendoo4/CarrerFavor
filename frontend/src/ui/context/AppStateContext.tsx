import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  // CV and JD text for sharing between tabs
  cvText: string;
  jdText: string;
  setCvText: (text: string) => void;
  setJdText: (text: string) => void;
  
  // Analysis results
  analysis: any | null;
  setAnalysis: (analysis: any | null) => void;
  
  // Score
  score: number | null;
  setScore: (score: number | null) => void;
  
  // Loading states
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error state
  error: string | null;
  setError: (error: string | null) => void;
  
  // Evaluation state
  evaluationResults: any[] | null;
  setEvaluationResults: (results: any[] | null) => void;
  showEvaluationResults: boolean;
  setShowEvaluationResults: (show: boolean) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cvText, setCvText] = useState<string>('');
  const [jdText, setJdText] = useState<string>('');
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluationResults, setEvaluationResults] = useState<any[] | null>(null);
  const [showEvaluationResults, setShowEvaluationResults] = useState<boolean>(false);

  const value: AppState = {
    cvText,
    jdText,
    setCvText,
    setJdText,
    analysis,
    setAnalysis,
    score,
    setScore,
    loading,
    setLoading,
    error,
    setError,
    evaluationResults,
    setEvaluationResults,
    showEvaluationResults,
    setShowEvaluationResults,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
