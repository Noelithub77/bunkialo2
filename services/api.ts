import axios from 'axios'
import { cookieStore } from './cookie-store'
import { debug } from '@/utils/debug'

const BASE_URL = 'https://lmsug24.iiitkottayam.ac.in'

// Axios instance for LMS requests
export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
  maxRedirects: 5,
  timeout: 30000,
})

// Request interceptor: attach cookies to outgoing requests
api.interceptors.request.use((config) => {
  const cookieHeader = cookieStore.getCookieHeader()
  if (cookieHeader) {
    config.headers.Cookie = cookieHeader
  }
  
  debug.api(`REQUEST: ${config.method?.toUpperCase()} ${config.url}`)
  debug.api(`Cookies attached: ${cookieStore.getCookieCount()}`)
  
  return config
})

// Response interceptor: store cookies from responses
api.interceptors.response.use(
  (response) => {
    const setCookie = response.headers['set-cookie']
    if (setCookie) {
      debug.api(`Response has Set-Cookie header`)
      cookieStore.setCookiesFromHeader(setCookie)
    }
    
    debug.api(`RESPONSE: ${response.status} ${response.config.url}`)
    debug.api(`Response size: ${response.data?.length || 0} chars`)
    
    return response
  },
  (error) => {
    debug.api(`ERROR: ${error.message}`)
    if (error.response) {
      debug.api(`Status: ${error.response.status}`)
    }
    return Promise.reject(error)
  }
)

// Clear all cookies
export const clearCookies = () => {
  cookieStore.clear()
}

// Get debug info
export const getDebugInfo = () => ({
  baseUrl: BASE_URL,
  cookieCount: cookieStore.getCookieCount(),
  cookies: cookieStore.getAllCookies(),
})

export { BASE_URL }
