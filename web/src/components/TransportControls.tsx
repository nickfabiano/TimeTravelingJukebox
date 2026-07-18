export interface TransportControlsProps {
  paused: boolean;
  shuffleOn: boolean;
  disabled: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleShuffle: () => void;
}

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
        &#x21C4;
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={onPrevious}
        disabled={disabled}
        aria-label="Previous track"
        title="Previous"
      >
        &#x23EE;
      </button>
      <button
        type="button"
        className="transport-btn transport-btn-play"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={paused ? 'Play' : 'Pause'}
        title={paused ? 'Play' : 'Pause'}
      >
        {paused ? <>&#x25B6;</> : <>&#x275A;&#x275A;</>}
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next track"
        title="Next"
      >
        &#x23ED;
      </button>
    </div>
  );
}
