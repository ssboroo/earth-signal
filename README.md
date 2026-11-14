# EARTH SIGNAL

**See what is changing on Earth.**

A zero-cost-first Earth observation dashboard built on openly accessible satellite imagery.

## Data sources

- **NASA GIBS / Worldview** — near-real-time global imagery layers (MODIS and VIIRS). Imagery is not live video; availability and latency depend on the satellite product.
- **OpenStreetMap** — community-maintained basemap data, subject to tile usage policy.
- **Copernicus Sentinel-1/2 and USGS Landsat** — planned archive/search integrations through public STAC catalogs. These are observation products, not continuous live feeds.

## Current MVP

- Interactive global map
- NASA GIBS satellite imagery overlay
- Layer switching and date selection
- Mongolia quick navigation
- Clear source, acquisition-date and latency disclosures
- No paid API keys required for the initial map

## Run locally

This is a static web app. Open `index.html` in a browser or serve the repository with any static HTTP server:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

## Zero-cost operating model

The application has no required backend or paid API dependency for the initial experience. Public endpoints have their own fair-use, availability and attribution policies. Production-scale hosting, heavy processing, persistent storage and commercial SLAs may incur costs.

## Important data limitations

“Near real time” does not mean live video. Satellite products are published after acquisition and processing, and cloud cover can obscure optical imagery. A map layer being visible does not itself prove a land-use change. Change alerts require temporal comparison, quality checks and validation.

## License

MIT
