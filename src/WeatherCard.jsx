// Intersection weather, sized to sit above the operational brief.

function WeatherIcon({ kind }) {
  if (kind === 'clear-day') {
    return (
      <svg className="weather-icon clear" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.4m0 14v2.4M2.6 12h2.4m14 0h2.4M5.3 5.3l1.7 1.7m10 10 1.7 1.7M18.7 5.3l-1.7 1.7m-10 10-1.7 1.7" />
      </svg>
    );
  }
  if (kind === 'clear-night') {
    return (
      <svg className="weather-icon clear" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 14.4A8.4 8.4 0 0 1 9.6 3.8 8.4 8.4 0 1 0 20.2 14.4Z" />
      </svg>
    );
  }
  if (kind === 'rainy') {
    return (
      <svg className="weather-icon rainy" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 15.8h9.6a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.2 9.4 3.2 3.2 0 0 0 7 15.8Z" />
        <path d="M8.6 18.6 8 20.6m4.2-2-.6 2m4.2-2-.6 2" />
      </svg>
    );
  }
  if (kind === 'unavailable') {
    return (
      <svg className="weather-icon unavailable" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 15.8h9.6a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.2 9.4 3.2 3.2 0 0 0 7 15.8Z" />
        <path d="M4.2 4.2 19.8 19.8" />
      </svg>
    );
  }
  return (
    <svg className="weather-icon cloudy" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 15.8h9.6a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.2 9.4 3.2 3.2 0 0 0 7 15.8Z" />
    </svg>
  );
}

function iconFor(weather) {
  if (!weather?.available) return 'unavailable';
  if (weather.scalar === 1) return 'rainy';
  if (weather.scalar === -1) return weather.isDay === false ? 'clear-night' : 'clear-day';
  return 'cloudy';
}

export default function WeatherCard({ weather }) {
  const available = Boolean(weather?.available);
  const temperature = available && weather.temperatureC != null
    ? Math.round(weather.temperatureC)
    : null;

  return (
    <section className="weather-card" aria-label="Intersection weather">
      <span className="weather-eyebrow">Weather</span>
      <WeatherIcon kind={iconFor(weather)} />
      <h2>{available ? weather.bucket : weather ? 'Unavailable' : 'Loading…'}</h2>
      <p className="weather-temp">
        {temperature != null ? <>{temperature}<small>°C</small></> : <span className="weather-dash">—</span>}
      </p>
      <div className="weather-extra">
        <span>Wind</span>
        <b>{available && weather.windKph != null ? `${Math.round(weather.windKph)} km/h` : '—'}</b>
      </div>
    </section>
  );
}
