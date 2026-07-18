// Minimal typings for the Spotify Web Playback SDK (loaded from sdk.scdn.co).

interface Window {
  onSpotifyWebPlaybackSDKReady: () => void;
  Spotify: typeof Spotify;
}

declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken(cb: (token: string) => void): void;
    volume?: number;
  }

  interface PlaybackTrack {
    name: string;
    uri: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  }

  interface PlaybackState {
    paused: boolean;
    shuffle: boolean;
    position: number;
    duration: number;
    track_window: { current_track: PlaybackTrack | null };
  }

  type ErrorEvent =
    | 'initialization_error'
    | 'authentication_error'
    | 'account_error'
    | 'playback_error';

  class Player {
    constructor(init: PlayerInit);
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
    addListener(
      event: 'player_state_changed',
      cb: (state: PlaybackState | null) => void,
    ): boolean;
    addListener(event: ErrorEvent, cb: (e: { message: string }) => void): boolean;
    activateElement(): Promise<void>;
    togglePlay(): Promise<void>;
    nextTrack(): Promise<void>;
    previousTrack(): Promise<void>;
    setVolume(volume: number): Promise<void>;
  }
}
