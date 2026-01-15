import axios from 'axios'
import { cookieStore } from './cookie-store'

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
})

// Request interceptor: attach cookies to outgoing requests
api.interceptors.request.use((config) => {
  const cookieHeader = cookieStore.getCookieHeader()
  if (cookieHeader) {
    config.headers.Cookie = cookieHeader
  }
  return config
})

// Response interceptor: store cookies from responses
api.interceptors.response.use((response) => {
  const setCookie = response.headers['set-cookie']
  cookieStore.setCookiesFromHeader(setCookie)
  return response
})

// Clear all cookies
export const clearCookies = () => {
  cookieStore.clear()
}

export { BASE_URL }
