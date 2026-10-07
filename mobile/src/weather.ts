const API = "https://api.open-meteo.com/v1/forecast";
const MODELS = [
  { id: "ecmwf_ifs025", label: "ECMWF IFS" },
  { id: "gfs_seamless", label: "NOAA GFS / HRRR" },
  { id: "icon_seamless", label: "DWD ICON" },
] as const;

export type ModelForecast = {
  label: string;
  current: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
  };
  daily: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };
  hourly: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
};

export type ForecastConsensus = {
  models: ModelForecast[];
  currentTemperature: number;
  temperatureRange: [number, number];
  modelSpread: number;
};

async function fetchModel(
  latitude: number,
  longitude: number,
  model: (typeof MODELS)[number],
): Promise<ModelForecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    models: model.id,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "10",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
  });
  const response = await fetch(API + "?" + params.toString());
  if (!response.ok) throw new Error(model.label + " forecast unavailable");
  const data = await response.json();
  if (data.error) throw new Error(model.label + " forecast unavailable");
  return { label: model.label, current: data.current ?? {}, daily: data.daily ?? {}, hourly: data.hourly ?? {} };
}

export async function loadConsensus(
  latitude: number,
  longitude: number,
): Promise<ForecastConsensus> {
  const settled = await Promise.allSettled(
    MODELS.map((model) => fetchModel(latitude, longitude, model)),
  );
  const models = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (models.length === 0) throw new Error("Forecasts are temporarily unavailable.");

  const values = models
    .map((model) => model.current.temperature_2m)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) throw new Error("No current temperature was returned.");

  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    models,
    currentTemperature: values.reduce((sum, value) => sum + value, 0) / values.length,
    temperatureRange: [low, high],
    modelSpread: high - low,
  };
}

export function conditionLabel(code?: number): string {
  if (code === undefined) return "Forecast loading";
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Mostly clear";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mixed conditions";
}
