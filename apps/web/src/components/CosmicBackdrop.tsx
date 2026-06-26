const meteors = Array.from({ length: 56 }, (_, index) => ({
  id: index,
  left: 4 + ((index * 17) % 102),
  top: -12 + ((index * 13) % 46),
  delay: -((index * 0.37) % 6.8),
  duration: 3.4 + (index % 8) * 0.42,
  size: 110 + (index % 7) * 34
}));

export function CosmicBackdrop() {
  return (
    <div className="cosmic-backdrop" aria-hidden="true">
      <div className="cosmic-sky" />
      <div className="cosmic-aurora aurora-a" />
      <div className="cosmic-aurora aurora-b" />
      <div className="star-dust" />
      <div className="meteor-field">
        {meteors.map((meteor) => (
          <span
            key={meteor.id}
            className="meteor"
            style={{
              left: `${meteor.left}%`,
              top: `${meteor.top}%`,
              width: `${meteor.size}px`,
              animationDelay: `${meteor.delay}s`,
              animationDuration: `${meteor.duration}s`
            }}
          />
        ))}
      </div>
      <div className="soft-horizon" />
    </div>
  );
}
