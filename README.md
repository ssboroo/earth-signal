# EARTH SIGNAL

**See what is changing on Earth.**

A zero-cost-first Earth observation workspace built on open satellite imagery, public STAC catalogs and in-browser geospatial analysis.

## Implemented

- Global MapLibre map with OpenStreetMap basemap and NASA GIBS MODIS Terra, MODIS Aqua and VIIRS true-colour imagery.
- UTC imagery date selection and a second-date opacity blend for visual comparison.
- Public Sentinel-2 L2A discovery from Element 84 Earth Search, bounded by the current map view.
- Scene metadata, cloud-cover filtering and Sentinel-2 scene footprints.
- On-demand Sentinel-2 spectral index sampling from public Cloud-Optimized GeoTIFF assets:
  - **NDVI** — vegetation signal (NIR and red).
  - **NDWI** — water signal (green and NIR).
  - **NBR** — vegetation / burn-scar signal (NIR and SWIR2).
- Optional Sentinel-2 Scene Classification Layer (SCL) masking for cloud, cirrus, shadow and snow classes when the catalog asset is available.
- Per-scene index mean, valid-sample percentage and broad interpretation labels.
- Draw, measure and save monitoring polygons in browser-local storage. Area is calculated geodesically in hectares.
- Node.js unit tests and GitHub Actions CI.

## Run locally

Requirements:
- Modern browser with ES modules, WebGL and HTTPS access to public data services.
- Python 3 (for the static local server).
- Node.js 20+ (for tests).

```bash
python -m http.server 8080
```

Open http://localhost:8080.

Run tests:

```bash
npm test
```

## Data and methodology notes

- **NASA GIBS** serves browse imagery. It is near-real-time, not live video; acquisition and processing latency applies.
- **Element 84 Earth Search STAC** provides Sentinel-2 L2A scene metadata and links to spectral COG assets.
- **GeoTIFF.js** is loaded on demand from jsDelivr to read small overview samples from remote COG assets using HTTP range requests.
- Index analysis samples each selected scene at up to 256 pixels wide. It is a scene-wide exploratory summary, not a full-resolution classified raster or a substitute for professional remote-sensing validation.
- NDVI, NDWI and NBR are normalized-difference indices. Their interpretation depends on season, biome, sensor conditions, atmospheric correction and local thresholds.
- SCL masking is applied only if the scene provides a readable SCL asset. The UI explicitly reports whether it was applied.
- The date-blend viewer is a visual comparison only. It does not register scenes or prove that a change occurred.
- Monitoring zones are stored in the current browser only. They are not synced to a server or shared with another user/device.
- OpenStreetMap public tiles and all satellite/catalog services have independent availability, attribution, fair-use and rate-limit policies.

## Not yet production capabilities

Automated recurring monitoring, co-registered before/after change detection, verified deforestation/mining/water alerts, full-resolution raster exports, multi-user accounts, server-side job queues, report delivery and organization-level access controls are not implemented. These require additional processing, validation and deployment infrastructure. This repository does not claim a live operational alert service.

## Zero-cost-first architecture

The prototype requires no paid API key and no application server. It relies on public services and browser-side processing. Public endpoints are not guaranteed to provide unlimited commercial use or service-level agreements. Large-area/high-frequency processing, durable shared storage and production traffic may require infrastructure and funding.

## License

MIT
