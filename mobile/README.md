# WeatherGlass mobile app (working title)

The Expo and React Native TypeScript app is isolated under `mobile/`; the Cloudflare website remains unchanged by mobile source files.

## Run on a Mac

1. Install Node.js 22.13 or later and Xcode.
2. From this directory, run `npm install`.
3. Run `npx expo-doctor` and `npm run typecheck`.
4. Run `npx expo run:ios` to build and launch the iOS simulator, or `npx expo run:android` for Android.

## Current native MVP

- Five bottom tabs: Forecast, Radar, Details, Plans, and Favorites.
- Forecast blends ECMWF IFS, NOAA GFS / HRRR, and DWD ICON equally and shows model disagreement.
- Radar uses interactive Leaflet tiles in a native WebView: pan, zoom, Map/Satellite, city recenter, precipitation opacity, and 13-frame Xweather playback. The app calls the Cloudflare Worker tile proxy; Xweather secrets remain server-side.
- Location search uses Open-Meteo geocoding. Saved places and multiple plans persist locally on the device.
- Details summarize the current model blend and per-model readings.

This first pass has no account or cloud sync. Official alerts, plan-specific time forecasts, location permission, widgets, and store identity are follow-up work. The public app name and final bundle IDs remain unconfirmed; app metadata is still marked as a preview.

## Guardrails

- Describe this as an equal-weight model blend, not an average of weather apps/providers.
- Show model readings/spread to make disagreement visible.
- Official severe alerts must override playful copy.
- Keep cloud accounts optional until sync provides clear value.
- Mobile stays excluded from Cloudflare static assets.
