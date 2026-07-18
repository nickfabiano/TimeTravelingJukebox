export interface TransportControlsProps {
  paused: boolean;
  shuffleOn: boolean;
  disabled: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleShuffle: () => void;
}

// Drawn SVG icons (not text glyphs) so every platform renders the same
// crisp shapes — text arrows turn into emoji on iOS.
const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
  </svg>
);

const PreviousIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M6 6h2v12H6zm12 0-8.5 6 8.5 6V6z" />
  </svg>
);

const NextIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M6 6l8.5 6L6 18V6zm10 0h2v12h-2z" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
  </svg>
);

export function TransportControls({
  paused,
  shuffleOn,
  disabled,
  onTogglePlay,
  onNext,
  onPrevious,
  onToggleShuffle,
}: TransportControlsProps) {
  return (
    <div className="transport">
      <button
        type="button"
        className={`transport-btn${shuffleOn ? ' transport-btn-active' : ''}`}
        onClick={onToggleShuffle}
        disabled={disabled}
        aria-pressed={shuffleOn}
        aria-label="Toggle shuffle"
        title="Shuffle"
      >
        <ShuffleIcon />
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={onPrevious}
        disabled={disabled}
        aria-label="Previous track"
        title="Previous"
      >
        <PreviousIcon />
      </button>
      <button
        type="button"
        className="transport-btn transport-btn-play"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={paused ? 'Play' : 'Pause'}
        title={paused ? 'Play' : 'Pause'}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next track"
        title="Next"
      >
        <NextIcon />
      </button>
    </div>
  );
}
