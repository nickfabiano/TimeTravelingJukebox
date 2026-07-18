export interface NowPlayingProps {
  track: Spotify.PlaybackTrack | null;
  emptyHint: string;
}

// Track/artist names come from the Spotify API and are untrusted data.
// They are only ever rendered as React text nodes (auto-escaped) — never
// via dangerouslySetInnerHTML.
export function NowPlaying({ track, emptyHint }: NowPlayingProps) {
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
      {art ? (
        <img className="now-playing-art" src={art} alt={`Album art for ${track.album.name}`} />
      ) : (
        <div className="now-playing-art now-playing-art-blank" />
      )}
      <div className="now-playing-text">
        <div className="now-playing-track">{track.name}</div>
        <div className="now-playing-artist">
          {track.artists.map((a) => a.name).join(', ')}
        </div>
      </div>
    </div>
  );
}
