# EARTH SIGNAL

**See what is changing on Earth.**

A zero-cost-first Earth observation workspace built on open satellite imagery, public STAC catalogs and in-browser geospatial analysis. Cloudflare is the single hosting platform for the web app, API, database, report objects and scheduled catalog discovery.

## Implemented

- Global MapLibre map with OpenStreetMap basemap and NASA GIBS MODIS Terra, MODIS Aqua and VIIRS true-colour imagery.
- UTC imagery date selection and a second-date opacity blend for visual comparison.
- Public Sentinel-2 L2A discovery from Element 84 Earth Search, bounded by the current map view.
- Scene metadata, cloud-cover filtering and Sentinel-2 scene footprints.
- On-demand Sentinel-2 spectral index sampling from public Cloud-Optimized GeoTIFF assets: NDVI, NDWI and NBR.
- Optional Sentinel-2 Scene Classification Layer masking for cloud, cirrus, shadow and snow classes when the catalog asset is available.
- Per-scene index mean, valid-sample percentage and broad interpretation labels.
- Draw, measure and save monitoring polygons in browser-local storage; export as GeoJSON.
- Optional authenticated synchronization of locally saved monitoring polygons to shared Cloudflare D1 zones. The administrator token is held in the page only and is not written to browser storage.
- Cloudflare Worker API for health checks, protected shared monitoring-zone CRUD, observation listing and R2 GeoJSON exports.
- Cloudflare D1 schema for monitoring zones, Sentinel-2 scene candidates and monitoring-run history.
- Six-hour scheduled Sentinel-2 catalog discovery for up to 20 active zones; new candidate scenes are stored in D1.
- Wrangler configuration, D1 migrations, GitHub Actions tests and optional automatic Cloudflare deployment.
- Node.js unit tests.

## Cloudflare architecture

| Capability | Cloudflare component |
| --- | --- |
| Static dashboard and browser modules | Workers Static Assets |
| HTTP API | Cloudflare Workers |
| Persistent relational data | D1 |
| GeoJSON exports and report files | R2 |
| Scheduled discovery | Workers Cron Triggers |
| Deployment | GitHub Actions + Wrangler |

No Railway, Supabase or Vercel service is required. The current application keeps large raster reads in the browser through public COG range requests; the Worker does not download or process full satellite rasters.

## First-time Cloudflare setup

The GitHub deployment workflow can provision the D1 database and R2 bucket automatically. No database UUID needs to be manually committed.

Requirements: a Cloudflare account with Workers, D1 and R2 enabled, plus a GitHub repository with Actions enabled.

1. Create a Cloudflare API token with account-level permissions:
   - Workers Admin (account-level; required because the workflow creates the first Worker)
   - D1: Read and D1: Write
   - Workers R2 Storage: Write
2. In GitHub, open **Settings → Secrets and variables → Actions** and add:
   - `CLOUDFLARE_API_TOKEN` — the scoped Cloudflare API token.
   - `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
   - `EARTH_SIGNAL_API_TOKEN` — a long, randomly generated secret for protected administrator API routes.
3. Push to the `main` branch or manually run **Actions → Cloudflare deploy → Run workflow**.
4. The workflow runs tests, finds or creates the `earth-signal-db` D1 database, finds or creates the `earth-signal-reports` R2 bucket, injects the account-specific database UUID into the deployment config, applies migrations, stores the API token as a Worker secret and deploys the application.
5. Open the successful workflow log to find the `workers.dev` deployment URL. A custom domain can be attached from the Cloudflare dashboard.

Resource creation is idempotent: subsequent deployments reuse the existing D1 database and R2 bucket. If credentials are absent, deployment is deliberately skipped; tests still run. Never commit API tokens or account credentials.

For local development, authenticate Wrangler with `npx wrangler@latest login`. Create the D1 database and R2 bucket manually only if you want to run the full stack locally; then replace the placeholder D1 UUID in `wrangler.jsonc`.

## GitHub automatic deployment

The workflow is `.github/workflows/cloudflare-deploy.yml`. It runs on pushes to `main` and manual dispatch. It provisions Cloudflare resources, applies database migrations and deploys the Worker after the three Actions secrets are configured.

## API

All API responses are JSON. `/api/health` is public; all other routes require `Authorization: Bearer <API_TOKEN>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Worker and D1 health |
| GET | `/api/zones` | List shared monitoring polygons |
| POST | `/api/zones` | Save a named GeoJSON Polygon |
| DELETE | `/api/zones/:id` | Delete a monitoring polygon |
| GET | `/api/observations` | List discovered Sentinel-2 scene candidates |
| POST | `/api/exports/zones` | Store a GeoJSON snapshot in R2 |

Example zone payload:

```json
{
  "name": "Mongolia monitoring area",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[104,47],[104.01,47],[104.01,47.01],[104,47.01],[104,47]]]
  }
}
```

## Run locally

Start the Cloudflare Worker and static assets locally:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

The local Worker requires a local D1 database for API routes. Apply migrations locally with Wrangler's local D1 workflow, or use the Cloudflare remote resources after authentication.

## Data and methodology notes

- NASA GIBS serves browse imagery. It is near-real-time, not live video; acquisition and processing latency applies.
- Element 84 Earth Search STAC provides Sentinel-2 L2A scene metadata and links to spectral COG assets.
- GeoTIFF.js is loaded on demand from jsDelivr to read small overview samples from remote COG assets using HTTP range requests.
- Index analysis samples each selected scene at up to 256 pixels wide. It is a scene-wide exploratory summary, not a full-resolution classified raster or a substitute for professional remote-sensing validation.
- SCL masking is applied only if the scene provides a readable SCL asset. The UI reports whether it was applied.
- The date-blend viewer is a visual comparison only. It does not register scenes or prove that a change occurred.
- Scheduled monitoring currently discovers and stores candidate Sentinel-2 scenes intersecting each zone. It does **not** yet compute pixel-level before/after differences or issue verified deforestation, mining, fire or water alerts.
- Shared API zones are protected by a single administrator bearer token. The dashboard offers an explicit sync action to upload local polygons and refresh shared zones; the token is entered by the administrator and is not persisted. This is a single-admin workflow, not end-user sign-in or role-based organization access.
- The Worker scans at most 20 active zones per six-hour run and queries a maximum of 10 scenes per zone. Public catalog availability and rate limits apply.
- OpenStreetMap public tiles and all satellite/catalog services have independent availability, attribution, fair-use and rate-limit policies.

## Production limitations

This is a deployable Cloudflare foundation, not a claim that a live Cloudflare deployment already exists. A real Cloudflare account, D1 database UUID, R2 bucket, API token and account ID are required for the first deployment. Those account credentials are not available in this repository session.

Full-resolution raster processing, co-registered before/after change detection, verified environmental alerts, multi-user authentication, organization-level access controls, Telegram/email notification delivery and operational SLAs still require further implementation and validation. Free-tier quotas are finite; sustained traffic and processing may incur charges.

## License

MIT
