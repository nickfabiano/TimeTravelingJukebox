// Authorization Code with PKCE — no client secret exists in this app.
// Access token lives in memory only; the refresh token is persisted in
// localStorage as a deliberate convenience tradeoff (see PROJECT_PLAN.md).

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = `${window.location.origin}/`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
];

const REFRESH_TOKEN_KEY = 'ttj_refresh_token';
const VERIFIER_KEY = 'ttj_pkce_verifier';
const STATE_KEY = 'ttj_oauth_state';

let accessToken: string | null = null;
let expiresAt = 0;
let refreshInFlight: Promise<void> | null = null;

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

export async function beginLogin(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const challenge = base64url(await sha256(verifier));
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

/** Handles the ?code= redirect. Returns true if a login just completed. */
export async function handleRedirectCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');
  if (!code && !oauthError) return false;

  // Scrub code/state out of the URL before anything else so they never sit
  // in history or leak via referrer.
  window.history.replaceState({}, '', window.location.pathname);

  if (oauthError) throw new Error(`Spotify login failed: ${oauthError}`);

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!expectedState || returnedState !== expectedState) {
    throw new Error('OAuth state mismatch — possible CSRF, login aborted.');
  }
  if (!verifier) throw new Error('Missing PKCE verifier — please log in again.');

  await requestToken({
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  return true;
}

async function requestToken(body: Record<string, string>): Promise<void> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  accessToken = data.access_token;
  expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
}

/** Returns a valid access token, refreshing if needed; null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < expiresAt) return accessToken;
  return forceRefresh();
}

/** Discards the cached access token and refreshes. Used on 401s. */
export async function forceRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  try {
    await refreshInFlight;
    return accessToken;
  } catch {
    logout();
    return null;
  }
}

export function hasSession(): boolean {
  return accessToken !== null || localStorage.getItem(REFRESH_TOKEN_KEY) !== null;
}

export function logout(): void {
  accessToken = null;
  expiresAt = 0;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
