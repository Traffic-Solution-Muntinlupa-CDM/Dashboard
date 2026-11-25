// Weather for the intersection, from the same provider the controller uses.
//
// deployed/config/cv.yaml runs:
//   provider: pipeline.sources.weather.OpenMeteoWeatherSource
//   lat: 14.4081   lon: 121.0415   refresh_seconds: 300
// which maps the WMO weather code onto the model's scalar:
//   -1 clear / 0 cloudy / 1 rainy
//
// The controller does not expose that scalar over REST, so this module reads the
// same endpoint directly. Same API, same coordinates, same refresh window, no
// key — the label is what differs, not the data. If /live ever carries
// `weather`, prefer it over this call.
export const WEATHER_REFRESH_MS = 10 * 60 * 1000;

const API_BASE = import.meta.env.VITE_WEATHER_URL || 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_LAT = 14.4081;
const DEFAULT_LON = 121.0415;
const REQUEST_TIMEOUT_MS = 8000;

// Short labels for a badge; the WMO table also drives the scalar below.
const WMO_LABELS = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm, hail',
  99: 'Thunderstorm, hail',
};

const CLEAR_CODES = new Set([0, 1]);
const CLOUDY_CODES = new Set([2, 3, 45, 48]);

/** Mirror of deployed/pipeline/sources/weather.py:_map_wmo — keep them in step. */
export function mapWmoScalar(code) {
  if (CLEAR_CODES.has(code)) return -1;
  if (CLOUDY_CODES.has(code)) return 0;
  return 1;
}

export function conditionFromScalar(scalar) {
  if (scalar === -1) return 'Clear';
  if (scalar === 0) return 'Cloudy';
  if (scalar === 1) return 'Rainy';
  return 'Unknown';
}

/** Badge tone: rain is a warning for the operator, clear conditions are normal. */
export function weatherTone(scalar) {
  if (scalar === 1) return 'warning';
  if (scalar === -1 || scalar === 0) return 'ok';
  return 'neutral';
}

function requestSignal(signal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

/**
 * Resolves (never throws except on abort) so the dashboard can show the rest of
 * the page while the weather is missing.
 */
export async function loadWeather(signal) {
  const lat = import.meta.env.VITE_WEATHER_LAT || DEFAULT_LAT;
  const lon = import.meta.env.VITE_WEATHER_LON || DEFAULT_LON;
  const url = `${API_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true`;

  let response;
  try {
    response = await fetch(url, {
      signal: requestSignal(signal),
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return {
      available: false,
      message: error?.name === 'TimeoutError' ? 'Open-Meteo timed out' : 'Open-Meteo unreachable',
    };
  }

  if (!response.ok) {
    return { available: false, message: `Open-Meteo answered ${response.status}` };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return { available: false, message: 'Open-Meteo returned an unreadable body' };
  }

  const current = payload?.current_weather;
  if (!current || !Number.isFinite(Number(current.weathercode))) {
    return { available: false, message: 'Open-Meteo returned no current weather' };
  }

  const code = Number(current.weathercode);
  const scalar = mapWmoScalar(code);
  const temperature = Number(current.temperature);
  const wind = Number(current.windspeed);

  return {
    available: true,
    scalar,
    condition: WMO_LABELS[code] ?? conditionFromScalar(scalar),
    temperatureC: Number.isFinite(temperature) ? temperature : null,
    windKph: Number.isFinite(wind) ? wind : null,
    isDay: Boolean(current.is_day),
    code,
    observedAt: current.time ?? null,
    source: 'Open-Meteo',
    fetchedAt: Date.now(),
  };
}
