# Japan Travel Planner 2026 | 日本行程规划 2026

An interactive, bilingual (EN / 中文) 10-day Japan itinerary planner for **Oct 23 – Nov 1, 2026**, covering **Hokkaido** and the **Kansai** region.

Live site: **https://kkyungshin.github.io/japan-travel-planner-2026/**

## Features

- **10-day itinerary** split into two legs — Hokkaido (Days 1–6) and Kansai (Days 7–10)
- **Bilingual toggle** — switch the entire UI between English and 中文
- **Interactive Leaflet map** with numbered pins for every stop
- **Real road routes** via the [OSRM](https://project-osrm.org/) routing API (free, no API key), with the CTS → ITM flight drawn as a dashed arc on Day 7
- **Public-transit routes** from a transit planner, with retries, progressive drawing and a road-corridor fallback for itineraries the planner gets wrong
- **Live JMA weather** — forecast, active warnings and any active typhoon for whichever place you click, straight from the [Japan Meteorological Agency](https://www.jma.go.jp) (public, key-free, CORS-enabled)
- **Day / region filtering** — jump between days or isolate Hokkaido vs. Kansai
- **"Locate Me" GPS** — uses your device location to show distance to the nearest itinerary stop, refreshing the coordinate readout, every distance badge and the map on a configurable interval. Requires HTTPS (the GitHub Pages URL provides this) and browser location permission. Off until you press the button
- **Live JST clock** and an auto-scrolling travel-alert ticker
- **Per-stop cost estimates** and daily estimated totals
- Mobile-first responsive layout with a map/itinerary toggle for small screens

## Tech

Plain HTML, Tailwind CSS (CDN), Leaflet (CDN), Font Awesome (CDN). No build step, no dependencies to install.

## Project structure

```
index.html              markup only
assets/css/styles.css   custom styles + light-mode overrides
assets/js/data.js       trip state and the daysData itinerary array
assets/js/routes.js     road / transit routing, caching, retries
assets/js/kit.js        the weather-notes copy
assets/js/weather.js    live JMA forecast, warnings and typhoon module
assets/js/app.js        everything else - map, itinerary, location, settings
```

The scripts are plain classic scripts sharing one global scope, loaded in the order above.

## Usage

Open `index.html` in a browser, or visit the live site above.

To run locally (needed for the GPS feature, since `file://` is not a secure context):

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Data

All itinerary data lives in the `daysData` array in `assets/js/data.js`. Each day has an `id`, `leg`, `date`, `color`, `estCost`, and a `stops` array of `{ name, time, desc, cost, lat, lng }` entries — with `name` and `desc` each carrying `en` and `zh` variants. Edit and redeploy to update the plan.

## Credits

- Map tiles & data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Routing by [OSRM](https://project-osrm.org/) / [Project OSRM](https://github.com/Project-OSRM/osrm-backend) and [Valhalla](https://valhalla.github.io/valhalla/)
- Weather, warnings and typhoon data by the [Japan Meteorological Agency](https://www.jma.go.jp/)