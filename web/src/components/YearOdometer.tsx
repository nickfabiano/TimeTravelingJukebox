// Mechanical-counter year display: each digit sits on a vertical reel that
// rolls to its position, odometer style.
export function YearOdometer({ year }: { year: number }) {
  const digits = String(year).split('');
  return (
    <div className="year-display" role="status" aria-label={`Year ${year}`}>
      {digits.map((d, i) => (
        <span className="year-reel" key={i} aria-hidden="true">
          <span
            className="year-reel-strip"
            style={{ transform: `translateY(-${Number(d) * 10}%)` }}
          >
            {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
              <span className="year-reel-digit" key={n}>
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
