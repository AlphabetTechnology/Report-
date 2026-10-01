"use client";

/**
 * Google sign-in for Drive using Google Identity Services (browser only, no server).
 * Access tokens last about an hour; we keep the current one in sessionStorage so
 * a page reload doesn't ask again.
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const CLIENT_ID_KEY = "sws_google_client_id";
const TOKEN_KEY = "sws_google_token";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string; message?: string }) => void;
  requestAccessToken: (o?: { prompt?: string }) => void;
}

interface GoogleOAuth {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleOAuth;
  }
}

export class NeedsAuthError extends Error {
  constructor() {
    super("Google Drive needs you to sign in again.");
  }
}

export function getGoogleClientId(): string {
  try {
    return localStorage.getItem(CLIENT_ID_KEY) || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  } catch {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  }
}

export function setGoogleClientId(id: string) {
  try {
    if (id) localStorage.setItem(CLIENT_ID_KEY, id.trim());
    else localStorage.removeItem(CLIENT_ID_KEY);
  } catch {
    /* ignore */
  }
  tokenClient = null;
}

let gisPromise: Promise<GoogleOAuth> | null = null;

function loadGis(): Promise<GoogleOAuth> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google sign-in failed to load")));
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Could not load Google sign-in. Check your internet connection."));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

let tokenClient: TokenClient | null = null;

function readToken(): { value: string; exp: number } | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null");
    return t && t.exp > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

/** A valid access token, or NeedsAuthError when the user must click to sign in. */
export function currentToken(): string {
  const t = readToken();
  if (!t) throw new NeedsAuthError();
  return t.value;
}

export function hasToken() {
  return readToken() !== null;
}

/**
 * Opens Google's sign-in popup. Must run from a click. When the user already
 * agreed before, the popup closes by itself straight away.
 */
export async function signIn(consent = false): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Add the Google client ID in Settings first.");
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient ??= google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });
    tokenClient.callback = (r) => {
      if (r.error || !r.access_token) {
        reject(new Error(r.error_description || r.error || "Google sign-in was cancelled"));
        return;
      }
      const t = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
      } catch {
        /* ignore */
      }
      resolve(t.value);
    };
    tokenClient.error_callback = (e) =>
      reject(new Error(e.type === "popup_closed" ? "Google sign-in was closed" : e.message || "Google sign-in failed"));
    tokenClient.requestAccessToken({ prompt: consent ? "consent" : "" });
  });
}

export function signOut() {
  const t = readToken();
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (t && window.google) window.google.accounts.oauth2.revoke(t.value);
}

/** Forget the token (e.g. after Google rejects it as expired). */
export function dropToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
