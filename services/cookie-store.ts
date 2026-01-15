// Simple in-memory cookie store for session management
// Works in React Native without native dependencies

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
    
    for (const header of headers) {
      const cookie = this.parseCookie(header)
      if (cookie) {
        this.cookies.set(cookie.name, cookie)
      }
    }
  }

  // Parse a single Set-Cookie header
  private parseCookie(header: string): Cookie | null {
    const parts = header.split(';').map(p => p.trim())
    if (parts.length === 0) return null

    const [nameValue, ...attributes] = parts
    const [name, value] = nameValue.split('=')
    if (!name || value === undefined) return null

    const cookie: Cookie = { name: name.trim(), value: value.trim() }

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
        this.cookies.delete(name)
        continue
      }
      validCookies.push(`${cookie.name}=${cookie.value}`)
    }

    return validCookies.join('; ')
  }

  // Clear all cookies
  clear() {
    this.cookies.clear()
  }

  // Check if we have any cookies
  hasCookies(): boolean {
    return this.cookies.size > 0
  }
}

// Singleton instance
export const cookieStore = new CookieStore()
