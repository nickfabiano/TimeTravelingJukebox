export interface NowPlayingProps {
  track: Spotify.PlaybackTrack | null;
  paused: boolean;
  /** Playback progress, 0..1. */
  progress: number;
  emptyHint: string;
}

// Track/artist names come from the Spotify API and are untrusted data.
// They are only ever rendered as React text nodes (auto-escaped) — never
// via dangerouslySetInnerHTML.
export function NowPlaying({ track, paused, progress, emptyHint }: NowPlayingProps) {
  if (!track) {
    return (
      <div className="now-playing now-playing-empty">
        <div className="now-playing-hint">{emptyHint}</div>
      </div>
    );
  }

  const art = track.album.images[0]?.url;
  return (
    <div className="now-playing">
      {/* Keyed on the track so each song "drops" a fresh record in. */}
      <div className="vinyl-entry" key={track.uri}>
        <div className={`vinyl${paused ? ' vinyl-paused' : ''}`}>
          {art ? (
            <img className="vinyl-label" src={art} alt={`Album art for ${track.album.name}`} />
          ) : (
            <div className="vinyl-label vinyl-label-blank" />
          )}
        </div>
      </div>
      <div className="now-playing-text">
        <div className="now-playing-track">{track.name}</div>
        <div className="now-playing-artist">
          {track.artists.map((a) => a.name).join(', ')}
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
