# WeatherGlass mobile app (working title)

This is the first React Native app shell, kept separate from the Cloudflare website. It uses Expo and TypeScript so the same mobile project can target iOS and Android.

## Run on a Mac

1. Install Node.js and Xcode.
2. From this directory, run `npm install`.
3. Run `npx expo-doctor` to verify the Expo and React Native versions.
4. Run `npx expo run:ios` to build and launch the iOS simulator, or `npx expo start` for a development session.

This initial screen calls the same three Open-Meteo model feeds as the web prototype (ECMWF IFS, NOAA GFS / HRRR, and DWD ICON) and displays the equal-weight current-temperature consensus with the model spread. It uses Warner Robins as a development location; location permission, saved places, radar tiles, plans, and notification delivery are the next implementation steps.

The mobile folder is excluded from Cloudflare static asset uploads. Xweather credentials stay on the Cloudflare Worker and must never be embedded in the mobile app.

## MVP screen order

1. Forecast: current conditions, model consensus and spread, hourly outlook, saved places.
2. Radar: native pan/zoom map, playback timeline, opacity, base map, and radar/severe layers.
3. Plan: choose a location, date, and time window; compare forecast conditions.
4. Settings: themes/glass tint, units, daily brief tone, location and alert preferences.

## Product guardrails

- Describe the feed as an equal-weight blend of forecast models, not an average of weather apps or providers.
- Show model values and spread so people can see disagreement.
- Let official severe alerts override playful forecast copy.
- Keep cloud accounts optional for the first release; add sync only when it has clear value.
- Confirm the public app name before store assets or final bundle identifiers are locked.
