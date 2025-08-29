import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type Role = 'candidate' | 'hr'

type User = { id: number; email: string; role: Role; avatar_path?: string }

type AuthContextValue = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, role: Role) => Promise<void>
  logout: () => void
  reloadUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user data on mount and when token changes
  useEffect(() => {
    const loadUser = async () => {
      console.log('AuthContext: Loading user, token:', token ? 'exists' : 'null');
      if (token) {
        try {
          localStorage.setItem('token', token)
          console.log('AuthContext: Making API call to /auth/me');
          const { data } = await axios.get(`${API}/auth/me`, { 
            headers: { Authorization: `Bearer ${token}` } 
          })
          console.log('AuthContext: User data received:', data);
          setUser(data)
        } catch (error) {
          console.error('AuthContext: Failed to load user:', error)
          // Token is invalid, clear it
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        }
      } else {
        console.log('AuthContext: No token, clearing user');
        localStorage.removeItem('token')
        setUser(null)
      }
      setLoading(false)
    }

    loadUser()
  }, [token])

  // Set up axios default headers
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  const login = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Attempting login for:', email);
      const { data } = await axios.post(`${API}/auth/login`, { email, password })
      console.log('AuthContext: Login successful, token received');
      setToken(data.access_token)
    } catch (error: any) {
      console.error('AuthContext: Login failed:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail)
      } else {
        throw new Error('Login failed. Please try again.')
      }
    }
  }
  const register = async (email: string, password: string, role: Role) => {
    try {
      await axios.post(`${API}/auth/register`, { email, password, role })
      await login(email, password)
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail)
      } else {
        throw new Error('Registration failed. Please try again.')
      }
    }
  }
  const reloadUser = async () => {
    if (token) {
      try {
        const { data } = await axios.get(`${API}/auth/me`, { 
          headers: { Authorization: `Bearer ${token}` } 
        })
        setUser(data)
      } catch (error) {
        console.error('Failed to reload user:', error)
      }
    }
  }

  const logout = () => setToken(null)

  const value = useMemo(() => ({ user, token, login, register, logout, loading, reloadUser }), [user, token, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

