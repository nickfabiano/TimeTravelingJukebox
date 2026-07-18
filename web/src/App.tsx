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
import { playPlaylist, setShuffle } from './spotify/api';
import { Knob } from './components/Knob';
import { TransportControls } from './components/TransportControls';
import { NowPlaying } from './components/NowPlaying';

const playlistsByYear = yearsData as Record<string, string>;
const YEARS = Object.keys(playlistsByYear)
  .map(Number)
  .sort((a, b) => a - b);
const MIN_YEAR = YEARS[0];
const MAX_YEAR = YEARS[YEARS.length - 1];
const DEFAULT_YEAR = 1985;

type Phase = 'boot' | 'signed-out' | 'off' | 'starting' | 'on';

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [volume, setVolume] = useState(60);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [playback, setPlayback] = useState<Spotify.PlaybackState | null>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffleOn;

  useEffect(() => {
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

  const powerOn = async () => {
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
      try {
        await playPlaylist(playlistId, handle.deviceId);
      } catch {
        // The device occasionally isn't registered yet right after power-on;
        // one short retry covers it.
        await new Promise((r) => setTimeout(r, 700));
        await playPlaylist(playlistId, handle.deviceId);
      }
      if (shuffleRef.current) await setShuffle(true, handle.deviceId);
      setActiveYear(selectedYear);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start playback.');
    }
  };

  const handleYearCommit = (committedYear: number) => {
    if (phase !== 'on') return;
    if (committedYear === activeYear) return;
    void playYear(committedYear);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    void playerRef.current?.player.setVolume(v / 100);
  };

  const handleToggleShuffle = () => {
    const handle = playerRef.current;
    if (!handle) return;
    const next = !shuffleOn;
    setShuffleOn(next);
    setShuffle(next, handle.deviceId).catch(() => setShuffleOn(!next));
  };

  const controlsDisabled = phase !== 'on' || activeYear === null;
  const track = playback?.track_window.current_track ?? null;

  return (
    <div className="stage">
      <div className="cabinet">
        <h1 className="marquee">Time Traveling Jukebox</h1>

        <div className="year-display" aria-live="polite">
          {String(year)
            .split('')
            .map((digit, i) => (
              <span className="year-digit" key={i}>
                {digit}
              </span>
            ))}
        </div>

        <NowPlaying
          track={phase === 'on' ? track : null}
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

        {phase === 'boot' && <div className="panel-message">Warming up the tubes…</div>}

        {phase === 'signed-out' && (
          <button type="button" className="big-btn" onClick={() => void beginLogin()}>
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
            paused={playback?.paused ?? true}
            shuffleOn={shuffleOn}
            disabled={controlsDisabled}
            onTogglePlay={() => void playerRef.current?.player.togglePlay()}
            onNext={() => void playerRef.current?.player.nextTrack()}
            onPrevious={() => void playerRef.current?.player.previousTrack()}
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
  );
}
