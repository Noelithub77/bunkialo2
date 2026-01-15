// Simple in-memory cookie store for session management
// Works in React Native without native dependencies

import { debug } from '@/utils/debug'

interface Cookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: Date
}

class CookieStore {
  private cookies: Map<string, Cookie> = new Map()

  // Parse Set-Cookie header and store cookies
  setCookiesFromHeader(setCookieHeader: string | string[] | undefined) {
    if (!setCookieHeader) return

    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    
    debug.cookie(`Received ${headers.length} Set-Cookie header(s)`)
    
    for (const header of headers) {
      const cookie = this.parseCookie(header)
      if (cookie) {
        this.cookies.set(cookie.name, cookie)
        debug.cookie(`Stored cookie: ${cookie.name}=${cookie.value.substring(0, 20)}...`)
      }
    }
    
    debug.cookie(`Total cookies stored: ${this.cookies.size}`)
  }

  // Parse a single Set-Cookie header
  private parseCookie(header: string): Cookie | null {
    const parts = header.split(';').map(p => p.trim())
    if (parts.length === 0) return null

    const [nameValue, ...attributes] = parts
    const eqIndex = nameValue.indexOf('=')
    if (eqIndex === -1) return null
    
    const name = nameValue.substring(0, eqIndex).trim()
    const value = nameValue.substring(eqIndex + 1).trim()
    if (!name) return null

    const cookie: Cookie = { name, value }

    for (const attr of attributes) {
      const [key, val] = attr.split('=')
      const keyLower = key?.toLowerCase().trim()
      
      if (keyLower === 'domain') cookie.domain = val?.trim()
      if (keyLower === 'path') cookie.path = val?.trim()
      if (keyLower === 'expires' && val) {
        cookie.expires = new Date(val.trim())
      }
    }

    return cookie
  }

  // Get cookie header string for requests
  getCookieHeader(): string {
    const now = new Date()
    const validCookies: string[] = []

    for (const [name, cookie] of this.cookies) {
      // Skip expired cookies
      if (cookie.expires && cookie.expires < now) {
        debug.cookie(`Cookie expired: ${name}`)
        this.cookies.delete(name)
        continue
      }
      validCookies.push(`${cookie.name}=${cookie.value}`)
    }

    const header = validCookies.join('; ')
    debug.cookie(`Cookie header (${validCookies.length} cookies): ${header.substring(0, 50)}...`)
    return header
  }

  // Clear all cookies
  clear() {
    const count = this.cookies.size
    this.cookies.clear()
    debug.cookie(`Cleared ${count} cookies`)
  }

  // Check if we have any cookies
  hasCookies(): boolean {
    return this.cookies.size > 0
  }

  // Get all cookies for debugging
  getAllCookies(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [name, cookie] of this.cookies) {
      result[name] = cookie.value
    }
    return result
  }

  // Get cookie count
  getCookieCount(): number {
    return this.cookies.size
  }
}

// Singleton instance
export const cookieStore = new CookieStore()
