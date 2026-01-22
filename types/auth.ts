/**
 * Authentication-related types
 */

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  username: string | null;
  error: string | null;
}

export interface LoginPageResponse {
  html: string;
  logintoken: string | null;
}

export interface LoginFormData {
  anchor: string;
  logintoken: string;
  username: string;
  password: string;
}
