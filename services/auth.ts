import * as SecureStore from 'expo-secure-store'
import { api, clearCookies } from './api'
import { parseHtml, querySelector, querySelectorAll, getAttr, hasMatch } from '@/utils/html-parser'

const CREDENTIALS_KEY = 'lms_credentials'

// Extract login token from the login page
const extractLoginToken = (html: string): string | null => {
  const doc = parseHtml(html)
  const tokenInput = querySelector(doc, 'input[name="logintoken"]')
  return getAttr(tokenInput, 'value')
}

// Check if login was successful by looking for user menu or error messages
const isLoginSuccessful = (html: string): boolean => {
  const doc = parseHtml(html)
  // Check for logged-in indicators
  const hasUserMenu = hasMatch(doc, '.usermenu, .userloggedinas, #loggedin-user, .logininfo')
  const hasLogoutLink = querySelectorAll(doc, 'a').some(el => {
    const href = getAttr(el, 'href')
    return href?.includes('logout')
  })
  // Check for error indicators
  const hasError = hasMatch(doc, '.loginerrors, .alert-danger, #loginerrormessage')
  
  return (hasUserMenu || hasLogoutLink) && !hasError
}

// Save credentials securely
export const saveCredentials = async (username: string, password: string) => {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ username, password }))
}

// Get saved credentials
export const getCredentials = async (): Promise<{ username: string; password: string } | null> => {
  const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY)
  if (!stored) return null
  return JSON.parse(stored)
}

// Clear saved credentials
export const clearCredentials = async () => {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY)
}

// Clear session (cookies)
export const clearSession = () => {
  clearCookies()
}

// Login to Moodle LMS
export const login = async (username: string, password: string): Promise<boolean> => {
  // Clear any existing session
  clearSession()
  
  // Step 1: Get the login page to extract CSRF token
  const loginPageResponse = await api.get('/login/index.php')
  const loginToken = extractLoginToken(loginPageResponse.data)
  
  if (!loginToken) {
    throw new Error('Could not extract login token from page')
  }
  
  // Step 2: Submit login form
  const formData = new URLSearchParams({
    anchor: '',
    logintoken: loginToken,
    username: username,
    password: password,
  })
  
  const loginResponse = await api.post('/login/index.php', formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  
  // Step 3: Verify login success
  const isSuccess = isLoginSuccessful(loginResponse.data)
  
  if (isSuccess) {
    await saveCredentials(username, password)
  }
  
  return isSuccess
}

// Check if we have a valid session
export const checkSession = async (): Promise<boolean> => {
  try {
    const response = await api.get('/my/')
    return isLoginSuccessful(response.data)
  } catch {
    return false
  }
}

// Try to restore session using saved credentials
export const tryAutoLogin = async (): Promise<boolean> => {
  const credentials = await getCredentials()
  if (!credentials) return false
  
  // First check if current session is valid
  const hasValidSession = await checkSession()
  if (hasValidSession) return true
  
  // Session expired, try to login again
  return await login(credentials.username, credentials.password)
}

// Logout - clear session and optionally credentials
export const logout = async (clearSavedCredentials = true) => {
  clearSession()
  if (clearSavedCredentials) {
    await clearCredentials()
  }
}
