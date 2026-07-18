# Time Traveling Jukebox — Project Plan

A jukebox that plays the best songs of any year you dial in. Turn the **Year** knob to pick a year, and the jukebox plays that year's curated Spotify playlist. Turn the **Volume** knob to control loudness. Standard transport controls (play/pause, next/previous, shuffle) round it out.

The project ships in two iterations:

1. **V1 — Web app:** a browser-based jukebox UI that streams audio through Spotify.
2. **V2 — Physical jukebox:** a Raspberry Pi–powered device with real knobs, a speaker, and custom housing, reusing the logic proven in V1.

---

## V1 — Web App

### Concept

A single-page web app that renders a stylized jukebox face with:

- **Year knob** — a rotary dial spanning the available years (currently **1960–2024**, see [Data](#data-year--playlist-mapping)). Detents/snapping per year, with the selected year shown prominently (e.g., a retro flip-digit or nixie-tube style display).
- **Volume knob** — a second rotary dial, 0–100%.
- **Transport buttons** — Play/Pause, Next, Previous, Shuffle toggle.
- **Now Playing display** — track name, artist, album art, and playback progress for the current song.

Changing the year knob at any time immediately switches playback to the new year's playlist.

### How playback works (Spotify)

Spotify does not allow arbitrary full-song streaming via a plain REST call — full playback in a browser requires the **Spotify Web Playback SDK**, which turns the browser tab into a Spotify Connect device. This is the core architectural decision for V1:

- **Spotify Web Playback SDK** (JS, loaded in the browser) — creates a Connect device inside the page and handles audio output, play/pause, seek, volume, and player state events.
- **Spotify Web API** (REST) — used to *target* that device: start a playlist on it, toggle shuffle, skip tracks.

**Requirements & constraints (important, non-negotiable on Spotify's side):**

- The listening user must have **Spotify Premium**. The Web Playback SDK does not work for free accounts.
- The app must be registered in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) to get a **Client ID**, with the app's URL added as a redirect URI.
- Auth uses **Authorization Code with PKCE** — this flow is designed for browser apps with no server-held secret, so **no backend is required**. Tokens live in the browser; refresh tokens keep the session alive.
- Required OAuth scopes: `streaming`, `user-read-email`, `user-read-private`, `user-read-playback-state`, `user-modify-playback-state`.
- Playback requires a user gesture to start (browser autoplay policy) — the UI should have an explicit "power on" / "connect" moment, which fits the jukebox metaphor nicely.

**Key API calls:**

| Action | Call |
|---|---|
| Start a year's playlist | `PUT /v1/me/player/play?device_id={id}` with body `{"context_uri": "spotify:playlist:<PLAYLIST_ID>"}` |
| Play / pause | SDK `player.togglePlay()` |
| Next / previous | SDK `player.nextTrack()` / `player.previousTrack()` |
| Shuffle on/off | `PUT /v1/me/player/shuffle?state={true\|false}&device_id={id}` |
| Volume | SDK `player.setVolume(0.0–1.0)` |
| Now-playing info | SDK `player_state_changed` event (no polling needed) |

**Year-change behavior:** on knob release (debounce ~300–500 ms so spinning through decades doesn't fire dozens of API calls), issue the `play` call with the new year's `context_uri`. Playback of the old playlist stops and the new one starts. If shuffle is on, re-assert it after switching context.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (single-page app, static hosting)  │
│                                             │
│  UI: knobs, buttons, now-playing display    │
│   │                                         │
│  years.json  ──►  year → playlist ID        │
│   │                                         │
│  Spotify Web Playback SDK (audio output)    │
│  Spotify Web API via fetch (control)        │
│  Auth: OAuth PKCE, tokens in memory/storage │
└─────────────────────────────────────────────┘
```

- **No backend.** Static site + PKCE covers everything. Host on GitHub Pages, Netlify, or Vercel.
- **Stack recommendation:** Vite + React + TypeScript. Plain enough to move fast, and componentizing the knobs pays off in V2 when the same state logic is driven by GPIO instead of mouse events. (Vanilla JS is acceptable if the executor prefers; the knob/state logic should stay decoupled from rendering either way.)
- **Data:** the year→playlist mapping is checked into the repo as a static `years.json` (source of truth table below). No Google Sheets call at runtime — the sheet was a working document, and freezing the data in-repo removes a dependency and an API key.

### The knob (the fun part)

- Circular drag interaction: pointer events mapped to angle around the knob center; also support scroll-wheel and arrow keys for accessibility.
- The year knob spans ~65 years; a single 270° sweep makes each year ~4°, which is too twitchy. Options (executor's choice, in order of preference):
  1. **Multi-turn knob** with a decade indicator — like a real tuning dial.
  2. Coarse/fine: knob drags through years slowly near the current position, faster with velocity.
  3. A 270° sweep with heavy snapping and a large knob radius.
- Show the year live while turning; only trigger playlist switch on release + debounce.

### Milestones

1. **Auth + hello playback** — PKCE login flow, SDK device created, hardcoded playlist plays. *(This derisks the whole project; do it first.)*
2. **Core controls** — play/pause, next/prev, shuffle, volume wired to real playback.
3. **Year knob + data table** — `years.json`, knob UI, year-switch behavior with debounce.
4. **Now Playing + polish** — track display, album art, jukebox visual design, loading/error states (no Premium, token expiry, no active device).
5. **Deploy** — static hosting, redirect URI registered, README with setup steps.

### Known gaps / open questions for V1

- **Year coverage:** the reference sheet covers **1960–2024**. The original vision was ~1950–2026. Missing: **1950–1959, 2025, 2026**. Options: create those playlists in Spotify and add rows, or constrain the knob to 1960–2024 for now. The app should read its range from `years.json` so adding years later is a data change, not a code change.
- **Whose account:** V1 assumes the user logs in with their own Premium account. Fine for personal use; a public deployment would need Spotify extended-quota approval.
- **Free-tier fallback (optional):** 30-second preview clips via the Web API could serve non-Premium visitors, but previews are inconsistently available and this is explicitly out of scope for the first pass.

### Security requirements

These are requirements, not suggestions — the implementation should follow all of them.

**Auth & tokens (the main attack surface):**

- **Authorization Code with PKCE only.** Never the implicit grant (deprecated, leaks tokens in URLs) and never the client-credentials or plain authorization-code flow in the browser — there must be **no client secret anywhere in this project**. PKCE is designed so a public client needs none; the Spotify Client ID is public by design and safe to commit.
- Include and verify the **`state` parameter** in the OAuth flow (CSRF protection); generate the PKCE `code_verifier` with `crypto.getRandomValues`, never `Math.random`.
- **Keep the access token in memory only** (a JS variable/closure), never in `localStorage`. If the refresh token is persisted for convenience across reloads, that's an explicit tradeoff against XSS — acceptable for a personal app, but it makes the XSS mitigations below load-bearing. Clearing tokens on logout must actually clear storage.
- Strip the authorization `code` from the URL (`history.replaceState`) immediately after the redirect callback is handled, so it never lands in browser history or referrer headers.

**XSS hardening (what protects those tokens):**

- Track names, artist names, and album metadata come from the Spotify API and must be treated as **untrusted data**: rendered as text, never via `innerHTML`/`dangerouslySetInnerHTML`. (React's default escaping covers this — the rule is "don't opt out of it.")
- Ship a strict **Content-Security-Policy**: `default-src 'self'`, with narrow allowances only for Spotify's SDK script origin (`sdk.scdn.co`), API (`api.spotify.com`, `accounts.spotify.com`), and album-art image CDN. No wildcard sources, no `unsafe-inline` scripts.
- **No third-party scripts** beyond the Spotify SDK — no analytics, no CDN-loaded libraries. Every foreign script is a token-theft vector in an app that holds tokens client-side.
- HTTPS only (static hosts do this by default); register the **exact** production redirect URI in the Spotify dashboard — no localhost redirect URIs left registered on the production app.

**Supply chain & repo hygiene:**

- Minimal dependency footprint; commit the lockfile; enable Dependabot (or `npm audit` in CI) on the repo.
- Nothing sensitive in the repo, ever: no tokens, no `.env` with secrets (there are none in V1, which is the point — keep it that way). Add a `.gitignore` from day one.

**V2 (Pi) security, for later:**

- The Pi will hold a **persisted refresh token** — store it in a file readable only by the service user (`chmod 600`, dedicated non-root user), outside the git working tree.
- Standard Pi hardening: change default credentials, SSH keys only, no ports exposed beyond the LAN, unattended security updates. librespot should only be discoverable on the local network.
- Consider a dedicated Spotify account for the device so a stolen/compromised jukebox doesn't expose your personal account.

---

## Data: Year → Playlist Mapping

Source: the "Spotify URIs" Google Sheet (frozen here as of 2026-07-18). Each ID is a Spotify playlist ID; the full URI is `spotify:playlist:<ID>` and the web URL is `https://open.spotify.com/playlist/<ID>`.

This table should be committed to the repo as `years.json` (`{"1960": "5Sbs0AwnT0nE5OaiyRIPoq", ...}`) during Milestone 3.

| Year | Playlist ID | Year | Playlist ID |
|---|---|---|---|
| 1960 | `5Sbs0AwnT0nE5OaiyRIPoq` | 1993 | `46OhPmNCrzScXzG0EUJB6K` |
| 1961 | `454c3rKKq3yQtW7O06kJYd` | 1994 | `31Xp6AhXhwXJtKjw7m6SUd` |
| 1962 | `0BNBifsKPqn93kRYePs1te` | 1995 | `2KW1NfinXoz9MQqQSNTr8J` |
| 1963 | `3ndpkQBUXpjrGm2aHPSuqM` | 1996 | `1b67rVWITtE4Zf2Ipvulz5` |
| 1964 | `3WxocwV0twbFuqn4XXFS8f` | 1997 | `3yfyX4JWFAq8NZZIVgHcfN` |
| 1965 | `7f6hqtduPqMOVm59rERSXp` | 1998 | `1xxGI0KXMNypOT2jSwQmmn` |
| 1966 | `1HuRYGJiM8lgb9U7KlNn7K` | 1999 | `3WAcfjCdho5Eie1mp1RuLT` |
| 1967 | `3BdRx1zOgUl1yakHTaBI1U` | 2000 | `3LRdsPTlN46cE5K0ZLWkeU` |
| 1968 | `6nqspGjHgcat2yjZXZfWRr` | 2001 | `6LHlHmGr1Pgd9OtSSflq0d` |
| 1969 | `4iriKeQ5swmxh1RcEexUsy` | 2002 | `2DFuWO0fcPiPtCwPfyj6qE` |
| 1970 | `26mFJHwOgDhaXro0Czn7uL` | 2003 | `33G9VnZmCtdo2Ipne1ADJu` |
| 1971 | `0pGaBaKjbKdONIpzKwk5jA` | 2004 | `3aZBAHah5b6aaHlpIMKZhl` |
| 1972 | `7tzJ3UJpxPGXORLMN82HoK` | 2005 | `5J8pLD41i6wDZclsxNcNwD` |
| 1973 | `1I0YHo7n5O26gelVZ9W8p9` | 2006 | `2xjL7zQj87I0rA5wB0JqnP` |
| 1974 | `2i5tA5fnAzuO1eF5bJtYCm` | 2007 | `64ARg9iJiIl647WoKd8a7A` |
| 1975 | `7BwcEfiSS9Dxzp9mQcVS4y` | 2008 | `2opyv6yMuKRM0cZA5jMijA` |
| 1976 | `3uteYreW2h8L5gFkNfsHkW` | 2009 | `2OjtmKOOnwvZlHQH483kTV` |
| 1977 | `0XoR4TYMkEnyDehO7O3J8d` | 2010 | `614lzhidVMANXW8lMWmuat` |
| 1978 | `6X5FYdwTYeI8nkOZwj7RY8` | 2011 | `7JuGWS6HPoJedv4VI3a6XV` |
| 1979 | `4MzsDSlrWSGSb1CckBJF7S` | 2012 | `26Fb38g3sQ4L4bZqwsdNzp` |
| 1980 | `5tdzcVXaiA3SzxlXX5XS0H` | 2013 | `196Twd06o2vBdYZJnem0cJ` |
| 1981 | `6R7q7lXY1VvAdhZb15071v` | 2014 | `4eWAlEidaG7gluryTlSwgS` |
| 1982 | `6hoDFRBI3sTfkXbbGZ5M48` | 2015 | `2wCsMXebgz1Het6S2JmUQu` |
| 1983 | `0p9lKtZI4rnqoLxPnlLK8X` | 2016 | `38TQpABnRPyIHpGAHK9DmX` |
| 1984 | `2XLi6XYvoIM9Uc4L2ST8AO` | 2017 | `6v7fhidDi7QAU7qUxH3dwx` |
| 1985 | `2qR3OwHWfiHpdwwXyYxIMe` | 2018 | `2AyDQJirLbL8vutqIga2IF` |
| 1986 | `2Y6iI5xP23lJ5cGpxKHLS1` | 2019 | `5hL9VH5znxJVuDC1yeYwmM` |
| 1987 | `0peH4KXO5QW4sbNCBVKgzX` | 2020 | `4lUQxcf0IrONl2iLSPpn42` |
| 1988 | `74DGLxxad712pQQez99vzK` | 2021 | `64VyqWHiQvC6uO9UdOzWVP` |
| 1989 | `4NoGcMseEM8ysWOdMprO59` | 2022 | `0VwbcR6tjYZTwMkiHWrOVQ` |
| 1990 | `0Uo7CAzjOh2QbPCXySTbuf` | 2023 | `2dqHqX8yLb2up1IuiZUlCp` |
| 1991 | `04mzgXGTSK68S9o7yB612h` | 2024 | `1S2lPoKqQNsGM7Wpli8Kct` |
| 1992 | `3yPlLvM7nVrSLREr6sgfln` | | |

---

## V2 — Physical Jukebox

*High-level direction only; detailed spec comes after V1 ships.*

### Concept

A tabletop jukebox: wooden or 3D-printed housing, a real speaker, two physical knobs (year + volume), arcade-style transport buttons, and a small display for the year and now-playing info. Powered by a Raspberry Pi.

### Likely architecture

- **Raspberry Pi 4/5** running **librespot** (e.g., via the Raspotify package), which makes the Pi itself a **Spotify Connect device** — same Connect model as V1, so the control code carries over almost unchanged: the Pi's controller app targets the librespot device with the same Web API calls the web app used to target the browser device.
- **Year knob:** rotary encoder (e.g., KY-040) on GPIO — infinite rotation, ideal for the multi-turn year dial.
- **Volume knob:** second rotary encoder, or a potentiometer via an ADC (MCP3008).
- **Buttons:** momentary arcade buttons on GPIO for play/pause, next, previous, shuffle.
- **Display:** small SPI/I²C display (OLED or ~3.5" LCD) for year + track info; alternatively reuse the V1 web UI in kiosk mode on a small touchscreen — a strong argument for keeping V1's UI and control logic decoupled.
- **Audio:** Pi's I²S out to a DAC + amplifier board (e.g., HiFiBerry Amp or a MAX98357A) driving a full-range speaker.
- **Controller software:** a Python or Node service translating GPIO events into the same Spotify Web API calls as V1, with a headless OAuth flow (one-time device authorization, refresh token persisted on the Pi).

### V2 open questions (park until V1 is done)

- Housing: 3D print vs. wood build vs. retrofitting a vintage radio shell.
- Display choice drives a lot of the design (character LCD vs. touchscreen kiosk).
- Startup behavior: auto-connect and resume last year on power-on?
- Spotify Premium account dedicated to the device vs. the owner's account.

---

## Repo layout (proposed)

```
TimeTravelingJukebox/
├── PROJECT_PLAN.md        ← this file
├── README.md
├── web/                   ← V1 app (Vite + React + TS)
│   ├── src/
│   │   ├── data/years.json
│   │   ├── components/    (Knob, TransportControls, NowPlaying, …)
│   │   └── spotify/       (auth.ts, player.ts, api.ts)
│   └── …
└── pi/                    ← V2 controller (later)
```
