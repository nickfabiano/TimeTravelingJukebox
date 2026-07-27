export interface PlayerHandle {
  player: Spotify.Player;
  deviceId: string;
}

export interface PlayerCallbacks {
  getToken: () => Promise<string | null>;
  onStateChange: (state: Spotify.PlaybackState | null) => void;
  onAuthError: (message: string) => void;
  onAccountError: (message: string) => void;
  onPlaybackError: (message: string) => void;
}

let sdkLoaded: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkLoaded) return sdkLoaded;
  sdkLoaded = new Promise<void>((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
  });
  return sdkLoaded;
}

export async function createPlayer(cb: PlayerCallbacks): Promise<PlayerHandle> {
  await loadSdk();

  const player = new window.Spotify.Player({
    name: 'Time Traveling Jukebox',
    getOAuthToken: (provide) => {
      void cb.getToken().then((token) => {
        if (token) provide(token);
      });
    },
    volume: 0.6,
  });

  player.addListener('player_state_changed', cb.onStateChange);
  // The SDK's messages are often just "Playback error", so log the whole
  // event — it carries the detail the UI strip cannot show.
  player.addListener('initialization_error', (e) => {
    console.error('[Spotify initialization_error]', e);
    cb.onPlaybackError(e.message);
  });
  player.addListener('authentication_error', (e) => {
    console.error('[Spotify authentication_error]', e);
    cb.onAuthError(e.message);
  });
  player.addListener('account_error', (e) => {
    console.error('[Spotify account_error]', e);
    cb.onAccountError(e.message);
  });
  player.addListener('playback_error', (e) => {
    console.error('[Spotify playback_error]', e);
    cb.onPlaybackError(e.message);
  });

  const deviceId = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for the Spotify player to become ready.')),
      15000,
    );
    player.addListener('ready', ({ device_id }) => {
      clearTimeout(timeout);
      resolve(device_id);
    });
    void player.connect().then((ok) => {
      if (!ok) {
        clearTimeout(timeout);
        reject(new Error('Could not connect to Spotify.'));
      }
    });
  });

  // Satisfies browser autoplay/media-activation rules, especially on mobile.
  await player.activateElement().catch(() => {});

  return { player, deviceId };
}
