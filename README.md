# EARTH SIGNAL

**See what is changing on Earth.**

A zero-cost-first Earth observation workspace using open satellite imagery and public geospatial catalogs.

## Live capabilities

- Interactive global map with NASA GIBS MODIS Terra, MODIS Aqua and VIIRS true-colour imagery.
- Date selection for NASA imagery products.
- Temporal comparison overlay: blend an earlier NASA observation over the selected date with adjustable opacity.
- Region shortcuts, map coordinates and scale.
- **Sentinel-2 scene discovery** from the public Element 84 Earth Search STAC API.
- Scene search uses the visible map bounds, the last 30 days, and a cloud-cover filter below 40%.
- Sentinel-2 scene footprints are drawn on the map; selecting a result zooms to its location.
- No paid API key is required for the initial experience.

## Data sources and limitations

- **NASA GIBS** — near-real-time MODIS/VIIRS imagery. This is not live video; satellite acquisition, processing and publication introduce latency.
- **Element 84 Earth Search STAC** — public Sentinel-2 L2A catalog search. The catalog returns scene metadata; this MVP does not yet render Sentinel-2 pixel assets as a continuous map layer.
- **OpenStreetMap** — community-maintained basemap, subject to tile usage policy.

Optical imagery can be obscured by clouds. A scene's cloud-cover metadata is an estimate and does not guarantee clear pixels over a particular site. A scene marker is an observation location, not a verified change alert.

## Run locally

Requires Node.js 20+ only for the test suite. The web app itself is static.

```bash
python -m http.server 8080
```

Open http://localhost:8080. The app loads MapLibre GL JS and satellite data services from their public endpoints.

Run tests:

```bash
npm test
```

## Zero-cost operating model

No paid API key or application backend is required for this MVP. Public services have independent availability, fair-use, attribution and rate-limit policies. Production-scale processing, long-term storage, commercial SLAs and high-volume tile traffic may require funding or infrastructure.

## Roadmap

1. Sentinel-2 visual previews and cloud-aware image comparison.
2. Before/after change detection using comparable scenes.
3. NDVI, NDWI and NBR indices.
4. User-defined monitoring zones and recurring checks.
5. Validated alerts, downloadable reports and organization accounts.

## License

MIT
