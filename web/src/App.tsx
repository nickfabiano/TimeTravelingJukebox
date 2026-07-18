import { useEffect, useRef, useState } from 'react';
import yearsData from './data/years.json';
import {
  beginLogin,
  handleRedirectCallback,
  hasSession,
  logout,
  getAccessToken,
} from './spotify/auth';
import { createPlayer, PlayerHandle } from './spotify/player';
import { getPlaylistLength, isDeviceNotFound, playPlaylist, setShuffle } from './spotify/api';
import { buttonClick, yearClunk } from './audio/sounds';
import { Knob } from './components/Knob';
import { TransportControls } from './components/TransportControls';
import { NowPlaying } from './components/NowPlaying';
import { YearOdometer } from './components/YearOdometer';

const playlistsByYear = yearsData as Record<string, string>;
const YEARS = Object.keys(playlistsByYear)
  .map(Number)
  .sort((a, b) => a - b);
const MIN_YEAR = YEARS[0];
const MAX_YEAR = YEARS[YEARS.length - 1];
const DEFAULT_YEAR = 1985;

type Phase = 'boot' | 'signed-out' | 'off' | 'starting' | 'on';

/** Subtle accent light that shifts with the decade you've dialed in. */
function decadeAccent(year: number): string {
  switch (Math.floor(year / 10) * 10) {
    case 1950:
      return '#ff6b5e';
    case 1960:
      return '#63d8c8';
    case 1970:
      return '#ff9a3c';
    case 1980:
      return '#ff5fb0';
    case 1990:
      return '#b48cff';
    case 2000:
      return '#5ec8ff';
    case 2010:
      return '#ffd76a';
    case 2020:
      return '#7dffb0';
    default:
      return '#ffb347';
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [volume, setVolume] = useState(60);
  const [shuffleOn, setShuffleOn] = useState(true);
  const [playback, setPlayback] = useState<Spotify.PlaybackState | null>(null);
  const [progress, setProgress] = useState(0);
  const [justLit, setJustLit] = useState(false);
  const playerRef = useRef<PlayerHandle | null>(null);
  const shuffleRef = useRef(true);
  shuffleRef.current = shuffleOn;

  useEffect(() => {
    // ?demo renders the powered-on UI with a fake track — no Spotify calls.
    // Used for visual testing and screenshots.
    if (new URLSearchParams(window.location.search).has('demo')) {
      setPhase('on');
      setActiveYear(DEFAULT_YEAR);
      setPlayback({
        paused: false,
        shuffle: true,
        position: 63000,
        duration: 180000,
        track_window: {
          current_track: {
            name: 'Take On Me',
            uri: 'demo',
            artists: [{ name: 'a-ha' }],
            album: { name: 'Hunting High and Low', images: [] },
          },
        },
      });
      return;
    }
    void (async () => {
      try {
        await handleRedirectCallback();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Login failed.');
      }
      setPhase(hasSession() ? 'off' : 'signed-out');
    })();
    return () => {
      playerRef.current?.player.disconnect();
      playerRef.current = null;
    };
  }, []);

  const track = phase === 'on' ? (playback?.track_window.current_track ?? null) : null;
  const paused = playback?.paused ?? true;

  // Interpolate playback progress between SDK state events.
  useEffect(() => {
    if (!playback || !track) {
      setProgress(0);
      return;
    }
    const duration = playback.duration || 1;
    let position = playback.position;
    setProgress(position / duration);
    if (playback.paused) return;
    const id = window.setInterval(() => {
      position = Math.min(position + 1000, duration);
      setProgress(position / duration);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playback, track]);

  // Reflect the current song in the tab title.
  useEffect(() => {
    if (track) {
      const artists = track.artists.map((a) => a.name).join(', ');
      document.title = `${paused ? '⏸' : '▶'} ${track.name} — ${artists}`;
    } else {
      document.title = 'Time Traveling Jukebox';
    }
  }, [track, paused]);

  const powerOn = async () => {
    buttonClick();
    // Discard any half-alive player from a previous power-on so repeated
    // presses can never stack ghost devices.
    playerRef.current?.player.disconnect();
    playerRef.current = null;
    setPhase('starting');
    setError(null);
    try {
      const handle = await createPlayer({
        getToken: getAccessToken,
        onStateChange: (state) => {
          setPlayback(state);
          if (state) setShuffleOn(state.shuffle);
        },
        onAuthError: () => {
          logout();
          playerRef.current = null;
          setPhase('signed-out');
          setError('Spotify session expired — please log in again.');
        },
        onAccountError: () => {
          setError('Spotify Premium is required for playback on this device.');
        },
        onPlaybackError: (message) => setError(message),
      });
      playerRef.current = handle;
      await handle.player.setVolume(volume / 100);
      setPhase('on');
      setJustLit(true);
      window.setTimeout(() => setJustLit(false), 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the player.');
      setPhase('off');
    }
  };

  const playYear = async (selectedYear: number) => {
    const handle = playerRef.current;
    if (!handle) return;
    const playlistId = playlistsByYear[String(selectedYear)];
    if (!playlistId) return;
    setError(null);
    try {
      // With shuffle on, drop the needle on a random track — Spotify would
      // otherwise always start a context at track 1 even in shuffle mode.
      let offset: number | undefined;
      if (shuffleRef.current) {
        const total = await getPlaylistLength(playlistId).catch(() => 0);
        if (total > 1) offset = Math.floor(Math.random() * total);
      }
      try {
        await playPlaylist(playlistId, handle.deviceId, offset);
      } catch {
        // The device occasionally isn't registered yet right after power-on;
        // one short retry covers it.
        await new Promise((r) => setTimeout(r, 700));
        await playPlaylist(playlistId, handle.deviceId, offset);
      }
      if (shuffleRef.current) await setShuffle(true, handle.deviceId);
      setActiveYear(selectedYear);
    } catch (e) {
      if (isDeviceNotFound(e)) {
        // The SDK device dropped off Spotify's side (tab slept, network blip).
        // Power-cycle so the user gets a clean restart instead of a dead knob.
        handle.player.disconnect();
        playerRef.current = null;
        setPlayback(null);
        setActiveYear(null);
        setPhase('off');
        setError('The jukebox lost its connection to Spotify — press Power On to reconnect.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not start playback.');
    }
  };

  const handleYearCommit = (committedYear: number) => {
    if (phase !== 'on') return;
    if (committedYear === activeYear) return;
    yearClunk();
    void playYear(committedYear);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    void playerRef.current?.player.setVolume(v / 100);
  };

  const handleToggleShuffle = () => {
    const handle = playerRef.current;
    if (!handle) return;
    buttonClick();
    const next = !shuffleOn;
    setShuffleOn(next);
    setShuffle(next, handle.deviceId).catch(() => setShuffleOn(!next));
  };

  const controlsDisabled = phase !== 'on' || activeYear === null;

  return (
    <div className="stage">
      <div className="jukebox">
        <div className="cabinet-star" aria-hidden="true">
          &#x2605;
        </div>
        <div className="foot foot-left" aria-hidden="true" />
        <div className="foot foot-right" aria-hidden="true" />
        <div className="frame-red">
          <div className="frame-cream-outer">
            <div className="tube">
              <div className="bubbles" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="bubble" />
                ))}
              </div>
              <div className="frame-cream-inner">
                <div
                  className={`cabinet${justLit ? ' just-lit' : ''}`}
                  data-phase={phase}
                  style={{ ['--accent' as string]: decadeAccent(year) }}
                >
                  <div className="grille" aria-hidden="true" />
                  <h1 className="marquee">Time Traveling Jukebox</h1>

                  <YearOdometer year={year} />

                  <NowPlaying
                    track={track}
                    paused={paused}
                    progress={progress}
                    emptyHint={
                      phase === 'signed-out' || phase === 'boot'
                        ? 'Connect Spotify to begin'
                        : phase === 'on'
                          ? 'Turn the year knob to start the music'
                          : 'Press Power On to warm up'
                    }
                  />

                  {error && (
                    <div className="error-strip" role="alert">
                      {error}
                    </div>
                  )}

                  {phase === 'boot' && (
                    <div className="panel-message">Warming up the tubes…</div>
                  )}

                  {phase === 'signed-out' && (
                    <button
                      type="button"
                      className="big-btn"
                      onClick={() => void beginLogin()}
                    >
                      Connect Spotify
                    </button>
                  )}

                  {(phase === 'off' || phase === 'starting') && (
                    <button
                      type="button"
                      className="big-btn"
                      onClick={() => void powerOn()}
                      disabled={phase === 'starting'}
                    >
                      {phase === 'starting' ? 'Powering on…' : 'Power On'}
                    </button>
                  )}

                  <div className="control-deck">
                    <div className="knob-row">
                      <Knob
                        label={`Year (${MIN_YEAR}–${MAX_YEAR})`}
                        value={year}
                        min={MIN_YEAR}
                        max={MAX_YEAR}
                        degreesPerUnit={16}
                        size={124}
                        display={String(year)}
                        onChange={setYear}
                        onCommit={handleYearCommit}
                        disabled={phase !== 'on'}
                      />
                      <Knob
                        label="Volume"
                        value={volume}
                        min={0}
                        max={100}
                        degreesPerUnit={2.7}
                        size={92}
                        display={`${volume}%`}
                        onChange={handleVolumeChange}
                        disabled={phase !== 'on'}
                      />
                    </div>
                    <TransportControls
                      paused={paused}
                      shuffleOn={shuffleOn}
                      disabled={controlsDisabled}
                      onTogglePlay={() => {
                        buttonClick();
                        void playerRef.current?.player.togglePlay();
                      }}
                      onNext={() => {
                        buttonClick();
                        void playerRef.current?.player.nextTrack();
                      }}
                      onPrevious={() => {
                        buttonClick();
                        void playerRef.current?.player.previousTrack();
                      }}
                      onToggleShuffle={handleToggleShuffle}
                    />
                  </div>

                  {phase === 'on' && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        playerRef.current?.player.disconnect();
                        playerRef.current = null;
                        logout();
                        setPlayback(null);
                        setActiveYear(null);
                        setPhase('signed-out');
                      }}
                    >
                      Log out
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
