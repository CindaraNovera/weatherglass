# Weatherglass

**Your transparent forecast.**

Weatherglass combines independent weather forecasts into a clear consensus view, while showing the underlying model differences and uncertainty. The prototype has a liquid-glass inspired interface, favorite locations, customizable dashboard cards, location details, and a radar screen.

## Run locally

Open `index.html` in a modern browser. The app is currently a single-file static web prototype and does not require a build step.

## Current prototype status

- City search and local favorite locations
- Reorderable dashboard cards; layout and favorites are stored in the browser
- Live forecast requests to the Open-Meteo API for ECMWF, NOAA, and DWD model feeds
- Air-quality data and detailed daily/hourly outlooks
- Radar screen is still illustrative; it is not connected to a live radar service
- No user accounts or cloud synchronization yet

## Notes before public or paid launch

The current forecast connection is for prototyping. Review provider licensing, commercial terms, attribution, usage limits, reliability, and privacy before public or paid distribution. The three-model blend currently uses equal weights and has not yet been calibrated against local forecast history.
