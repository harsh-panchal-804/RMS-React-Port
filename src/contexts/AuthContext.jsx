import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const REDIRECT_URL = import.meta.env.VITE_REDIRECT_URL; // Optional: override redirect URL

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync role from backend
  const syncRoleFromBackend = async (accessToken, supabaseUser) => {
    try {
      console.log('🔄 Syncing role from backend...');
      console.log('📍 API URL:', `${API_BASE_URL}/me`);
      console.log('🔑 Token present:', !!accessToken);
      
      const response = await axios.get(`${API_BASE_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Backend response:', response.status, response.data);

      if (response.status === 200) {
        const userData = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          avatar: supabaseUser.user_metadata?.avatar_url,
          role: response.data.role || 'USER',
        };

        console.log('✅ User data set:', userData);
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userRole', userData.role);
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error syncing role from backend:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      if (error.response?.status === 403) {
        // User not registered in database
        alert('Access denied. Your email is not registered in the system.\n\nPlease contact your administrator to add your email to the database.');
        // Clear any partial state
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        setLoading(false);
      } else if (error.response?.status === 401) {
        // Invalid token
        alert('Authentication failed. Please try logging in again.');
        // Clear any partial state
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        setLoading(false);
      } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        // Network error - API might be down, but allow user to proceed with basic auth
        console.warn('⚠️ Network error - API unavailable, proceeding with Supabase auth only');
        const userData = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          avatar: supabaseUser.user_metadata?.avatar_url,
          role: 'USER', // Default role when API is unavailable
        };
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userRole', userData.role);
        setLoading(false);
        alert('Warning: Unable to connect to backend API. You are logged in but some features may not work.');
      } else {
        // Other errors - show message but allow basic access
        console.warn('⚠️ Backend error, proceeding with basic auth');
        const userData = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          avatar: supabaseUser.user_metadata?.avatar_url,
          role: 'USER', // Default role
        };
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userRole', userData.role);
        setLoading(false);
        alert(`Warning: ${error.response?.data?.detail || error.message || 'Backend connection failed'}. You are logged in but some features may not work.`);
      }
    }
  };

  // Sign out helper
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      navigate('/');
    }
  };

  // Initialize auth state from localStorage and check Supabase session
  useEffect(() => {
    const initializeAuth = async () => {
      // First, check for existing Supabase session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          console.log('✅ Found existing Supabase session');
          const accessToken = session.access_token;
          const userData = session.user;
          
          // Always sync role from backend to ensure it's up-to-date
          // This ensures role is always correct even if it changed on the backend
          // or if localStorage has stale data
          console.log('🔄 Re-validating role from backend...');
          await syncRoleFromBackend(accessToken, userData);
          return;
        }
      } catch (error) {
        console.log('ℹ️ No existing Supabase session:', error);
      }
      
      // Fallback to localStorage (only if no Supabase session)
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Validate token is still valid by checking with backend
          try {
            const response = await axios.get(`${API_BASE_URL}/me`, {
              headers: {
                'Authorization': `Bearer ${storedToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.status === 200) {
              // Update role from backend response
              const updatedUser = {
                ...parsedUser,
                role: response.data.role || parsedUser.role || 'USER',
              };
              setUser(updatedUser);
              setToken(storedToken);
              localStorage.setItem('user', JSON.stringify(updatedUser));
              localStorage.setItem('userRole', updatedUser.role);
              setLoading(false);
            } else {
              throw new Error('Invalid response');
            }
          } catch (validationError) {
            // Token might be expired, try to refresh or clear
            console.warn('⚠️ Token validation failed, clearing stored data');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userRole');
            setLoading(false);
          }
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('userRole');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      console.log('🔍 Checking OAuth callback...', { code: !!code, error });

      if (error) {
        console.error('❌ OAuth error:', error);
        alert(`OAuth Error: ${error}`);
        setLoading(false);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code) {
        try {
          console.log('🔄 Exchanging OAuth code for session...');
          setLoading(true);
          // Exchange code for session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('❌ Error exchanging code for session:', exchangeError);
            alert(`Authentication Error: ${exchangeError.message}`);
            setLoading(false);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }

          if (data.session) {
            console.log('✅ Session obtained, syncing with backend...');
            const accessToken = data.session.access_token;
            const userData = data.user;

            // Sync role from backend (this will also store token and user)
            await syncRoleFromBackend(accessToken, userData);

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.error('❌ No session in response');
            setLoading(false);
          }
        } catch (error) {
          console.error('❌ Error handling OAuth callback:', error);
          alert(`Error: ${error.message}`);
          setLoading(false);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // No code, not a callback
        console.log('ℹ️ No OAuth code in URL');
      }
    };

    handleAuthCallback();
  }, []);

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      // Use environment variable if set, otherwise use current origin
      // This allows you to override the redirect URL if needed
      const redirectTo = REDIRECT_URL || `${window.location.origin}${window.location.pathname}`;
      
      console.log('🔐 Initiating Google OAuth');
      console.log('📍 Current URL:', window.location.href);
      console.log('📍 Redirect URL:', redirectTo);
      console.log('⚠️ Make sure this redirect URL is added to Supabase allowed redirect URLs!');
      console.log('⚠️ Expected redirect URL: http://localhost:8501');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: false, // Let Supabase handle the redirect
        },
      });

      if (error) {
        console.error('❌ Error signing in with Google:', error);
        alert(`OAuth Error: ${error.message}\n\nMake sure http://localhost:8501 is added to Supabase redirect URLs.\n\nGo to: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs`);
        throw error;
      }

      // Supabase should redirect automatically
      if (data?.url) {
        console.log('🔐 OAuth URL generated:', data.url);
        console.log('🔄 Redirecting to Google...');
        // The redirect happens automatically via Supabase
      } else {
        console.warn('⚠️ No redirect URL returned from Supabase');
      }
    } catch (error) {
      console.error('❌ Error initiating Google OAuth:', error);
      alert(`Failed to initiate Google sign-in: ${error.message}`);
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    signInWithGoogle,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
