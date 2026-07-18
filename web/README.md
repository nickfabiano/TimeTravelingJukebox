# Time Traveling Jukebox — Web App (V1)

Dial in a year (1960–2024), and the jukebox plays that year's best-of Spotify playlist.

**Requirements:** a Spotify **Premium** account (the Web Playback SDK does not work on free accounts) and a registered Spotify app (free, takes 2 minutes).

## 1. Register a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and click **Create app**.
2. Name it anything (e.g., "Time Traveling Jukebox").
3. Under **Redirect URIs**, add:
   - `http://127.0.0.1:5173/` (local development — Spotify allows plain HTTP only on the 127.0.0.1 loopback, not `localhost`)
   - your production URL later, e.g. `https://your-app.vercel.app/` (exact match, trailing slash included)
4. Under APIs used, select **Web API** and **Web Playback SDK**.
5. Copy the **Client ID**. (There is no client secret in this project — the PKCE flow doesn't use one.)
6. In the app's **User Management** tab, add the Spotify account emails that will use the jukebox. New Spotify apps run in Development Mode, which allows up to 25 explicitly allowlisted users — plenty for a personal jukebox.

## 2. Run locally

```bash
cd web
cp .env.example .env       # then paste your Client ID into .env
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** (use this exact host — it must match the redirect URI), click **Connect Spotify**, log in, click **Power On**, and turn the year knob.

## 3. Deploy (Vercel)

1. Push this repo to GitHub (already done if you're reading this there).
2. At <https://vercel.com>, **Add New → Project**, import the repo.
3. Set **Root Directory** to `web` (framework preset: Vite — auto-detected).
4. Add environment variable `VITE_SPOTIFY_CLIENT_ID` = your Client ID.
5. Deploy. Copy the production URL (e.g., `https://time-traveling-jukebox.vercel.app/`).
6. Back in the Spotify dashboard, add that exact URL (with trailing slash) as a redirect URI.

`vercel.json` in this directory ships the security headers (strict CSP, no-referrer, frame denial). If Spotify changes its CDN/API hostnames and playback breaks, the CSP `connect-src`/`media-src` lists are the first place to look.

## Controls

| Control | Mouse | Keyboard (when focused) |
|---|---|---|
| Knobs | drag in a circle, or scroll wheel | arrows ±1, PgUp/PgDn ±10, Home/End |
| Year switch | release the knob (or stop scrolling) | same |
| Transport | play/pause, prev, next, shuffle buttons | — |

## Notes

- The year range is data-driven from `src/data/years.json`. To add 1950–1959 or 2025+, create the playlists in Spotify and add rows — no code changes needed.
- Access tokens are held in memory; a refresh token is stored in `localStorage` so you stay logged in across reloads (see the security section of `../PROJECT_PLAN.md` for the reasoning). **Log out** clears it.
