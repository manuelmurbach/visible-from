// terrain_app.js – main application logic

const TILE_BASE_URL = 'cache/tiles';
const ZOOM = 12; // must match ZOOM in dem_math.js
const TILE_SIZE = 256;
const TILE_CONCURRENCY = 12; // parallel tile fetches; compute is fast, loading is now the bottleneck

// ---------------------------------------------------------------------------
// Fixed analysis quality – always maximum.
// maxRangeKm  – viewshed radius (also limits tile loading area)
// subsample   – DEM downsampling factor before sweep (1 = full native resolution)
// outSize     – longest edge of the output overlay image (px)
// shadowStepM – shadow ray step size (m); smaller = sharper shadows, slower
// shadowOutSize – longest edge of shadow overlay image (px)
// ---------------------------------------------------------------------------
const CONFIG = {
    maxRangeKm: 300, subsample: 1, outSize: 2048, shadowStepM: 30, shadowOutSize: 1536,
};

// Well-known peaks for one-click selection (lat, lon, official summit elevation in m)
const PEAK_PRESETS = {
    dufourspitze:  { name: 'Dufourspitze',   lat: 45.936833, lon: 7.867056, elev: 4634 },
    matterhorn:    { name: 'Matterhorn',     lat: 45.976390, lon: 7.658610, elev: 4478 },
    bachtel:       { name: 'Bachtel',        lat: 47.294720, lon: 8.886390, elev: 1115 },
    montblanc:     { name: 'Mont Blanc',     lat: 45.832620, lon: 6.865200, elev: 4805 },
    todi:          { name: 'Tödi',           lat: 46.811380, lon: 8.914830, elev: 3614 },
    vrenelisgartli:{ name: 'Vrenelisgärtli', lat: 47.007800, lon: 9.016980, elev: 2904 },
    uetliberg:     { name: 'Uetliberg',      lat: 47.350000, lon: 8.491700, elev: 870 },
    pizbernina:    { name: 'Piz Bernina',    lat: 46.380600, lon: 9.908100, elev: 4049 },
    eiger:         { name: 'Eiger',          lat: 46.577500, lon: 8.005300, elev: 3967 },
};

// Switzerland's bounding box plus ~50 km padding on every side. Used both to
// restrict the map view (only swisstopo-covered area is shown, no OSM fallback
// exists any more) and as the "Download Elevation Data" prefetch area.
const SWITZERLAND_BOUNDS = { lat_min: 45.368, lat_max: 48.257, lon_min: 5.300, lon_max: 11.148 };

let map;
let overlayLayer    = null;
let selectedPeak    = null;
let visMarker       = null;
let currentMode     = 'visibility';
let viewshedWorker  = null;
let shadowWorker    = null;

// Neither compute button can be used until the Switzerland-wide DEM tile
// download has completed at least once – this guarantees Compute never
// triggers a fresh network fetch (both compute tile ranges are clamped to
// exactly the area this download covers).
let tilesReady = false;

function updateComputeButtonAvailability() {
    document.getElementById('btn-compute-vis').disabled  = !(tilesReady && selectedPeak);
    document.getElementById('btn-compute-shad').disabled = !tilesReady;
}

// Bumped whenever the current peak selection changes or a new computation
// starts; an in-flight computeViewshed()/computeShadow() checks its token
// before ever touching the DOM so a stale result (e.g. from a peak the user
// already clicked away from, or a cancelled run) can't overwrite the UI.
let vsToken     = 0;
let shadowToken = 0;

// ---------------------------------------------------------------------------
// Main-thread tile decoding (no OffscreenCanvas – compatible with all browsers)
// ---------------------------------------------------------------------------

const _decCanvas = document.createElement('canvas');
_decCanvas.width  = TILE_SIZE;
_decCanvas.height = TILE_SIZE;
const _decCtx = _decCanvas.getContext('2d', { willReadFrequently: true });

// Tile coordinate math (mirrors dem_math.js – needed before worker is spun up)
function _latLonToTile(lat, lon) {
    const latRad = lat * Math.PI / 180;
    const n      = Math.pow(2, ZOOM);
    return {
        x: (lon + 180) / 360 * n,
        y: (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n
    };
}

// Shared elevation-tile cache – both Peak Visibility and Shade Map read/write
// this same cache (they use the same DEM tile source, just different extents),
// so a tile downloaded once for either mode is never re-fetched for the other.
const tileCache = new Map(); // `${z}_${x}_${y}` -> Float32Array(256*256), in-memory only

// Persistent, cross-reload tile cache backed by the browser's Cache Storage
// API (the same storage Service Workers use – no SW registration needed to
// read/write it). Keyed by a synthetic per-tile URL, not a real endpoint.
const PERSISTENT_CACHE_NAME = 'terrain-tiles-v1';
let _persistentCachePromise = null;
function getPersistentCache() {
    if (!_persistentCachePromise) {
        _persistentCachePromise = ('caches' in window)
            ? caches.open(PERSISTENT_CACHE_NAME)
            : Promise.resolve(null);
    }
    return _persistentCachePromise;
}

function decodeTilePng(blob) {
    return createImageBitmap(blob).then(bitmap => {
        _decCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
        _decCtx.drawImage(bitmap, 0, 0);
        const { data } = _decCtx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
        const elev = new Float32Array(TILE_SIZE * TILE_SIZE);
        for (let i = 0; i < elev.length; i++)
            elev[i] = (data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256) - 32768;
        return elev;
    });
}

// Load one DEM tile and return a Float32Array[256×256] of elevations.
// Serves from the in-memory cache first, then the persistent (cross-reload)
// cache, and only hits the network if neither has it.
async function loadTile(z, x, y) {
    const key = `${z}_${x}_${y}`;
    if (tileCache.has(key)) return tileCache.get(key);

    const persistentCache = await getPersistentCache();
    const persistentKey = `https://terrain-tile-cache.local/${key}.png`;

    if (persistentCache) {
        const cachedResp = await persistentCache.match(persistentKey);
        if (cachedResp) {
            const elev = await decodeTilePng(await cachedResp.blob());
            tileCache.set(key, elev);
            updateTileCacheLabel();
            return elev;
        }
    }

    const urls = [
        `${TILE_BASE_URL}/${z}_${x}_${y}.png`,
        `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
    ];
    for (const url of urls) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const elev = await decodeTilePng(blob);
            tileCache.set(key, elev);
            updateTileCacheLabel();
            if (persistentCache) {
                persistentCache.put(persistentKey, new Response(blob, {
                    headers: { 'Content-Type': 'image/png' }
                })).catch(() => {});
            }
            return elev;
        } catch (_) { /* try next URL */ }
    }
    console.warn(`[tiles] failed to load ${z}/${x}/${y}`);
    return null; // tile unavailable – will be filled with zeros (not cached, so a retry is possible later)
}

// Fetch+cache every tile in a range without assembling a mosaic – used by the
// "Download Elevation Data" prefetch control so tiles land in tileCache ahead
// of time and computeViewshed/computeShadow (which call loadMosaic → loadTile)
// pick them up for free.
async function prefetchTiles(xtMin, xtMax, ytMin, ytMax, onProgress) {
    const tilesToLoad = [];
    for (let ty = ytMin; ty <= ytMax; ty++)
        for (let tx = xtMin; tx <= xtMax; tx++)
            tilesToLoad.push({ tx, ty });

    let done = 0;
    let nextIdx = 0;

    async function worker() {
        while (nextIdx < tilesToLoad.length) {
            const { tx, ty } = tilesToLoad[nextIdx++];
            await loadTile(ZOOM, tx, ty);
            done++;
            if (onProgress) onProgress(done, tilesToLoad.length);
        }
    }

    const workerCount = Math.min(TILE_CONCURRENCY, tilesToLoad.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
}

// Load all tiles covering [xtMin..xtMax] × [ytMin..ytMax] and stitch into
// a single Float32Array mosaic.  Calls onProgress(done, total) periodically.
async function loadMosaic(xtMin, xtMax, ytMin, ytMax, onProgress) {
    const cols = xtMax - xtMin + 1;
    const rows = ytMax - ytMin + 1;
    const pw   = cols * TILE_SIZE;
    const ph   = rows * TILE_SIZE;

    const mosaic = new Float32Array(pw * ph); // zero = sea level fallback

    const tilesToLoad = [];
    for (let ty = ytMin; ty <= ytMax; ty++)
        for (let tx = xtMin; tx <= xtMax; tx++)
            tilesToLoad.push({ tx, ty });

    let done = 0;
    let nextIdx = 0;

    async function fetchWorker() {
        while (nextIdx < tilesToLoad.length) {
            const { tx, ty } = tilesToLoad[nextIdx++];
            const tileElev = await loadTile(ZOOM, tx, ty);
            if (tileElev) {
                const colOff = (tx - xtMin) * TILE_SIZE;
                const rowOff = (ty - ytMin) * TILE_SIZE;
                for (let r = 0; r < TILE_SIZE; r++) {
                    const mosaicRow = (rowOff + r) * pw + colOff;
                    mosaic.set(tileElev.subarray(r * TILE_SIZE, (r + 1) * TILE_SIZE), mosaicRow);
                }
            }
            done++;
            if (onProgress) onProgress(done, tilesToLoad.length);
        }
    }

    const workerCount = Math.min(TILE_CONCURRENCY, tilesToLoad.length);
    await Promise.all(Array.from({ length: workerCount }, fetchWorker));

    return { elev: mosaic, pw, ph, xtMin, ytMin, xtMax, ytMax };
}

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

// View is restricted to the swisstopo coverage area (Switzerland + ~50 km
// padding) – there's no fallback basemap outside it any more.
const swissViewBounds = L.latLngBounds(
    [SWITZERLAND_BOUNDS.lat_min, SWITZERLAND_BOUNDS.lon_min],
    [SWITZERLAND_BOUNDS.lat_max, SWITZERLAND_BOUNDS.lon_max]
);

map = L.map('map', {
    center: [46.85, 8.2], zoom: 9,
    maxBounds: swissViewBounds,
    maxBoundsViscosity: 1.0
});
map.setMinZoom(map.getBoundsZoom(swissViewBounds));

const swisstopoLayer = L.tileLayer(
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    { attribution: '© <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>', maxZoom: 17 }
);
swisstopoLayer.addTo(map);

map.on('click', onMapClick);

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-visibility').classList.toggle('active', mode === 'visibility');
    document.getElementById('btn-shadow').classList.toggle('active', mode === 'shadow');
    document.getElementById('section-vis').style.display  = mode === 'visibility' ? 'flex' : 'none';
    document.getElementById('section-shad').style.display = mode === 'shadow'     ? 'flex' : 'none';
    if (mode === 'shadow' && window.resyncDateTimeWheels) window.resyncDateTimeWheels();
}
window.setMode = setMode;

// ---------------------------------------------------------------------------
// Mobile panel toggle – on narrow screens (see CSS) the panel becomes a
// slide-over drawer instead of a permanent sidebar, so the map is usable.
// ---------------------------------------------------------------------------

function togglePanel() {
    const isOpen = document.getElementById('panel').classList.toggle('open');
    document.getElementById('panel-toggle').classList.toggle('open', isOpen);
}
window.togglePanel = togglePanel;

// ---------------------------------------------------------------------------
// Map click – peak selection
// ---------------------------------------------------------------------------

// Abandons any viewshed computation still in flight for a previously
// selected peak, so its result can never land after the user has already
// moved on to a different peak (which was overwriting the elevation field
// with a stale value once the old computation finally finished).
function abandonInFlightViewshed() {
    const wasRunning = document.getElementById('btn-cancel').style.display === 'block';
    vsToken++;
    if (viewshedWorker) { viewshedWorker.terminate(); viewshedWorker = null; }
    document.getElementById('btn-cancel').style.display = 'none';
    if (wasRunning) setStatus('Select a mode above to begin.', 0);
}

function onMapClick(e) {
    if (currentMode !== 'visibility') return;
    const { lat, lng } = e.latlng;
    abandonInFlightViewshed();
    selectedPeak = { lat, lon: lng };

    if (visMarker) map.removeLayer(visMarker);
    visMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<b>Selected peak</b><br>${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`)
        .openPopup();

    document.getElementById('vis-coords').textContent =
        `${lat.toFixed(5)}° N,  ${lng.toFixed(5)}° E`;
    document.getElementById('peak-elev').value = '';
    updateComputeButtonAvailability();
}

// ---------------------------------------------------------------------------
// Preset peak buttons
// ---------------------------------------------------------------------------

function selectPreset(key) {
    const peak = PEAK_PRESETS[key];
    if (!peak) return;

    abandonInFlightViewshed();
    selectedPeak = { lat: peak.lat, lon: peak.lon };

    if (visMarker) map.removeLayer(visMarker);
    visMarker = L.marker([peak.lat, peak.lon])
        .addTo(map)
        .bindPopup(`<b>${peak.name}</b><br>${peak.lat.toFixed(5)}°N, ${peak.lon.toFixed(5)}°E, ${peak.elev} m`)
        .openPopup();

    document.getElementById('vis-coords').textContent =
        `${peak.name} — ${peak.lat.toFixed(5)}° N,  ${peak.lon.toFixed(5)}° E`;
    document.getElementById('peak-elev').value = '';
    updateComputeButtonAvailability();

    map.setView([peak.lat, peak.lon], map.getZoom());
}
window.selectPreset = selectPreset;

// ---------------------------------------------------------------------------
// Status & progress
// ---------------------------------------------------------------------------

function setStatus(msg, pct) {
    document.getElementById('status').textContent = msg;
    if (pct != null)
        document.getElementById('progress-fill').style.width = Math.round(pct) + '%';
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------

function applyResult({ buffer, width, height, bounds }) {
    if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }

    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(
        new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0
    );

    const url     = canvas.toDataURL('image/png');
    const lBounds = [[bounds.south, bounds.west], [bounds.north, bounds.east]];
    overlayLayer  = L.imageOverlay(url, lBounds, { opacity: 1, interactive: false }).addTo(map);
}

function cancelComputation() {
    vsToken++;     // invalidates any computeViewshed() still awaiting tiles
    shadowToken++; // invalidates any computeShadow() still awaiting tiles
    if (viewshedWorker) { viewshedWorker.terminate(); viewshedWorker = null; }
    if (shadowWorker)   { shadowWorker.terminate();   shadowWorker   = null; }
    updateComputeButtonAvailability();
    document.getElementById('btn-cancel').style.display  = 'none';
    setStatus('Cancelled.', 0);
}
window.cancelComputation = cancelComputation;

function clearOverlays() {
    if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
    document.getElementById('legend-vis').style.display    = 'none';
    document.getElementById('legend-shadow').style.display = 'none';
    setStatus('Overlays cleared.', 0);
}
window.clearOverlays = clearOverlays;

// ---------------------------------------------------------------------------
// Tile-range calculations – shared between the actual computations and the
// "Download Elevation Data" prefetch control, since both need to know exactly
// which tiles a given analysis will touch.
// ---------------------------------------------------------------------------

// Clip a tile range to the Switzerland+padding area kept pre-cached by the
// "Download Elevation Data" control, so Compute never needs a fresh network
// fetch – anything past that padding is simply outside the analysis.
function clampToSwitzerland(range) {
    const ch = getSwitzerlandTileRange();
    return {
        xtMin: Math.max(range.xtMin, ch.xtMin), xtMax: Math.min(range.xtMax, ch.xtMax),
        ytMin: Math.max(range.ytMin, ch.ytMin), ytMax: Math.min(range.ytMax, ch.ytMax)
    };
}

// Viewshed tile range: a square of maxRangeKm around the peak, clipped to
// Switzerland+padding (the nominal radius is 300 km, but anything beyond the
// pre-cached area is ignored rather than triggering new downloads).
function getViewshedTileRange(lat, lon) {
    const rangeKm  = CONFIG.maxRangeKm;
    const rangeDeg = rangeKm / 111.32;
    const tl = _latLonToTile(lat + rangeDeg, lon - rangeDeg / Math.cos(lat * Math.PI / 180));
    const br = _latLonToTile(lat - rangeDeg, lon + rangeDeg / Math.cos(lat * Math.PI / 180));
    return clampToSwitzerland({
        xtMin: Math.floor(tl.x), xtMax: Math.floor(br.x),
        ytMin: Math.floor(tl.y), ytMax: Math.floor(br.y)
    });
}

// Shadow tile range: current viewport expanded by the sun-angle shadow margin.
// Returns null if the sun is below the horizon (no tiles needed – result is a
// flat "everything dark" overlay).
function getShadowTileRange() {
    const dt = getSelectedDateTime();

    const centre    = map.getCenter();
    const sunPos    = SunCalc.getPosition(dt, centre.lat, centre.lng);
    const sunAltDeg = sunPos.altitude * 180 / Math.PI;
    if (sunAltDeg <= 0) return null;

    const bounds = map.getBounds();
    const viewBounds = {
        lat_min: bounds.getSouth(), lat_max: bounds.getNorth(),
        lon_min: bounds.getWest(),  lon_max: bounds.getEast()
    };

    const tanAlt     = Math.tan(sunAltDeg * Math.PI / 180);
    const maxShadowM = Math.min(80000, Math.max(3000, 4000 / tanAlt));
    const marginDeg  = maxShadowM / 111320;
    const extBounds  = {
        lat_min: viewBounds.lat_min - marginDeg,
        lat_max: viewBounds.lat_max + marginDeg,
        lon_min: viewBounds.lon_min - marginDeg,
        lon_max: viewBounds.lon_max + marginDeg,
    };

    const tl = _latLonToTile(extBounds.lat_max, extBounds.lon_min);
    const br = _latLonToTile(extBounds.lat_min, extBounds.lon_max);
    return clampToSwitzerland({
        xtMin: Math.floor(tl.x), xtMax: Math.floor(br.x),
        ytMin: Math.floor(tl.y), ytMax: Math.floor(br.y)
    });
}

// ---------------------------------------------------------------------------
// "Download Elevation Data" control – prefetches DEM tiles for the whole of
// Switzerland (fixed bounding box, independent of current pan/zoom/mode) into
// the shared tileCache, so both Peak Visibility and Shade Map compute against
// warm cache no matter where on the map they're used afterwards.
// ---------------------------------------------------------------------------

function getSwitzerlandTileRange() {
    const tl = _latLonToTile(SWITZERLAND_BOUNDS.lat_max, SWITZERLAND_BOUNDS.lon_min);
    const br = _latLonToTile(SWITZERLAND_BOUNDS.lat_min, SWITZERLAND_BOUNDS.lon_max);
    return {
        xtMin: Math.floor(tl.x), xtMax: Math.floor(br.x),
        ytMin: Math.floor(tl.y), ytMax: Math.floor(br.y)
    };
}

function updateTileCacheLabel() {
    const el = document.getElementById('tile-dl-status');
    if (el) el.textContent = `Tiles cached: ${tileCache.size}`;
}

async function downloadElevationData() {
    const range = getSwitzerlandTileRange();

    const btn = document.getElementById('btn-download-tiles');
    btn.disabled = true;
    document.getElementById('tile-dl-progress-fill').style.width = '0%';

    await prefetchTiles(range.xtMin, range.xtMax, range.ytMin, range.ytMax, (done, total) => {
        document.getElementById('tile-dl-status').textContent = `Downloading ${done}/${total}…`;
        document.getElementById('tile-dl-progress-fill').style.width = Math.round((done / total) * 100) + '%';
    });

    updateTileCacheLabel();
    btn.disabled = false;
    tilesReady = true;
    updateComputeButtonAvailability();
}
window.downloadElevationData = downloadElevationData;

// ---------------------------------------------------------------------------
// Viewshed computation
// ---------------------------------------------------------------------------

async function computeViewshed() {
    if (!selectedPeak || !tilesReady) return;

    const myToken = ++vsToken; // invalidates any computation already in flight

    document.getElementById('btn-compute-vis').disabled = true;
    document.getElementById('legend-vis').style.display = 'flex';
    document.getElementById('btn-cancel').style.display = 'block';
    setStatus('Starting viewshed…', 0);

    const cfg = CONFIG;

    // Tile range for viewshed area centred on peak
    const lat = selectedPeak.lat, lon = selectedPeak.lon;
    const { xtMin, xtMax, ytMin, ytMax } = getViewshedTileRange(lat, lon);

    console.log('[app] viewshed tile range', { xtMin, xtMax, ytMin, ytMax });

    let mosaic;
    try {
        mosaic = await loadMosaic(xtMin, xtMax, ytMin, ytMax, (done, total) => {
            if (myToken !== vsToken) return; // superseded – ignore
            setStatus(`Loading tiles ${done}/${total}…`, (done / total) * 30);
        });
    } catch (err) {
        if (myToken !== vsToken) return;
        setStatus('Error loading tiles: ' + err.message, 0);
        updateComputeButtonAvailability();
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    if (myToken !== vsToken) return; // a different peak was selected while tiles were loading

    setStatus('Tiles loaded – computing viewshed…', 30);

    if (viewshedWorker) viewshedWorker.terminate();
    viewshedWorker = new Worker('viewshed_worker.js');

    viewshedWorker.onerror = function (err) {
        if (myToken !== vsToken) return;
        console.error('[app] viewshed worker error:', err);
        setStatus(`Worker error: ${err.message || err} (see browser console F12)`, 0);
        updateComputeButtonAvailability();
        document.getElementById('btn-cancel').style.display = 'none';
    };

    viewshedWorker.onmessage = function (e) {
        if (myToken !== vsToken) return; // superseded – ignore stale result
        const d = e.data;
        if (d.type === 'progress') {
            setStatus(d.message, 30 + d.percent * 0.7);
        } else if (d.type === 'result') {
            applyResult(d);
            document.getElementById('peak-elev').value = Math.round(d.peakElev);
            setStatus(`Done. Peak elevation: ${Math.round(d.peakElev)} m (auto-detected from DEM + 50 m buffer)`, 100);
            updateComputeButtonAvailability();
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'error') {
            setStatus('Error: ' + d.message, 0);
            updateComputeButtonAvailability();
            document.getElementById('btn-cancel').style.display = 'none';
        }
    };

    viewshedWorker.postMessage(
        {
            elev: mosaic.elev.buffer, pw: mosaic.pw, ph: mosaic.ph,
            xtMin, ytMin, xtMax, ytMax,
            peakLat: lat, peakLon: lon,
            subsample: cfg.subsample, outSize: cfg.outSize
        },
        [mosaic.elev.buffer]
    );
}
window.computeViewshed = computeViewshed;

// ---------------------------------------------------------------------------
// Shadow computation
// ---------------------------------------------------------------------------

async function computeShadow() {
    if (!tilesReady) return;
    const myToken = ++shadowToken; // invalidates any computation already in flight

    document.getElementById('btn-compute-shad').disabled = true;
    document.getElementById('legend-shadow').style.display = 'flex';
    document.getElementById('btn-cancel').style.display = 'block';

    const dt = getSelectedDateTime();

    const centre = map.getCenter();
    const sunPos = SunCalc.getPosition(dt, centre.lat, centre.lng);
    const sunAltDeg = sunPos.altitude * 180 / Math.PI;

    // suncalc azimuth: 0 = south, π/2 = west → convert to compass (0=N, 90=E)
    let sunAzDeg = (sunPos.azimuth * 180 / Math.PI) + 180;
    if (sunAzDeg >= 360) sunAzDeg -= 360;

    if (sunAltDeg <= 0) {
        const bounds = map.getBounds();
        applyResult(makeDarkOverlay(bounds));
        setStatus('Sun is below the horizon – everything is in shadow.', 100);
        updateComputeButtonAvailability();
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    setStatus(`Sun: ${sunAzDeg.toFixed(0)}° az, ${sunAltDeg.toFixed(1)}° alt – loading tiles…`, 0);

    const cfg    = CONFIG;
    const bounds = map.getBounds();
    const viewBounds = {
        lat_min: bounds.getSouth(), lat_max: bounds.getNorth(),
        lon_min: bounds.getWest(),  lon_max: bounds.getEast()
    };

    const { xtMin, xtMax, ytMin, ytMax } = getShadowTileRange();

    console.log('[app] shadow tile range', { xtMin, xtMax, ytMin, ytMax });

    let mosaic;
    try {
        mosaic = await loadMosaic(xtMin, xtMax, ytMin, ytMax, (done, total) => {
            if (myToken !== shadowToken) return; // superseded – ignore
            setStatus(`Loading tiles ${done}/${total}…`, (done / total) * 35);
        });
    } catch (err) {
        if (myToken !== shadowToken) return;
        setStatus('Error loading tiles: ' + err.message, 0);
        updateComputeButtonAvailability();
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    if (myToken !== shadowToken) return; // cancelled/superseded while tiles were loading

    setStatus('Tiles loaded – computing shadows…', 35);

    if (shadowWorker) shadowWorker.terminate();
    shadowWorker = new Worker('shade_worker.js');

    shadowWorker.onerror = function (err) {
        if (myToken !== shadowToken) return;
        console.error('[app] shadow worker error:', err);
        setStatus(`Worker error: ${err.message || err} (see browser console F12)`, 0);
        updateComputeButtonAvailability();
        document.getElementById('btn-cancel').style.display = 'none';
    };

    shadowWorker.onmessage = function (e) {
        if (myToken !== shadowToken) return; // superseded – ignore stale result
        const d = e.data;
        if (d.type === 'progress') {
            setStatus(d.message, 35 + d.percent * 0.65);
        } else if (d.type === 'result') {
            applyResult(d);
            setStatus(`Done. Sun: ${sunAzDeg.toFixed(0)}° az, ${sunAltDeg.toFixed(1)}° alt`, 100);
            updateComputeButtonAvailability();
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'allDark') {
            applyResult(makeDarkOverlay(map.getBounds()));
            setStatus('Sun below horizon – everything is in shadow.', 100);
            updateComputeButtonAvailability();
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'error') {
            setStatus('Error: ' + d.message, 0);
            updateComputeButtonAvailability();
            document.getElementById('btn-cancel').style.display = 'none';
        }
    };

    shadowWorker.postMessage(
        {
            elev: mosaic.elev.buffer, pw: mosaic.pw, ph: mosaic.ph,
            xtMin, ytMin,
            sunAzimuthDeg: sunAzDeg, sunAltitudeDeg: sunAltDeg,
            viewBounds, shadowStepM: cfg.shadowStepM, shadowOutSize: cfg.shadowOutSize
        },
        [mosaic.elev.buffer]
    );
}
window.computeShadow = computeShadow;

// Solid-dark overlay for "all in shadow" case
function makeDarkOverlay(lBounds) {
    const W = 4, H = 4;
    const buf = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        buf[i*4]=20; buf[i*4+1]=20; buf[i*4+2]=60; buf[i*4+3]=160;
    }
    return {
        buffer: buf.buffer, width: W, height: H,
        bounds: { north: lBounds.getNorth(), south: lBounds.getSouth(),
                  west:  lBounds.getWest(),  east:  lBounds.getEast() }
    };
}

// ---------------------------------------------------------------------------
// Shade Map date/time controls – two horizontal "wheel" strips (date above
// time), swipe/drag/scroll to scrub, unbounded in both directions (crossing
// midnight on the time wheel just keeps going, rolling the date with it).
// The time wheel only ever shows daylight – night (before sunrise, after
// sunset + SUNSET_BUFFER_MIN) is skipped entirely, so scrolling jumps
// straight from dusk to the next dawn. Time is quantized to TIME_STEP_MIN;
// "now" is always rounded up to the next step. 0.2s after either wheel stops
// moving, the shade map is recomputed.
// ---------------------------------------------------------------------------

const TIME_STEP_MIN      = 5;
const TICK_MS             = TIME_STEP_MIN * 60000;
const SUNSET_BUFFER_MIN   = 5;   // minutes of "dusk" kept visible past actual sunset
const WHEEL_ITEM_WIDTH    = 48;  // px – must match .wheel-item width
const WHEEL_SETTLE_MS     = 200; // idle time before a wheel is considered "at rest"

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad2(n) { return String(n).padStart(2, '0'); }

function roundUpToStep(d, stepMin) {
    const ms = stepMin * 60000;
    return new Date(Math.ceil(d.getTime() / ms) * ms);
}

let selectedDateTime = roundUpToStep(new Date(), TIME_STEP_MIN);

// Returns a copy – callers only read it, this keeps selectedDateTime as the
// single mutable source of truth.
function getSelectedDateTime() {
    return new Date(selectedDateTime);
}

function onDoubleTapOrClick(el, handler) {
    el.addEventListener('dblclick', handler);
    let lastTap = 0;
    el.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 350) handler();
        lastTap = now;
    });
}

// Calendar-day ticks (whole days), DST-safe via setDate() rather than raw
// millisecond math. Shared by the date wheel and the sun-filtered time wheel.
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function dayStart(d)   { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
const dateEpoch = dayStart(new Date()); // day tick 0 = the day the app was opened
function dateFromDayTick(t) { return addDays(dateEpoch, t); }
function dayTickFromDate(d) { return Math.round((dayStart(d) - dateEpoch) / 86400000); }

// A horizontally scrollable, snap-to-item picker over an unbounded integer
// "tick" space. Only `windowSize` items are ever in the DOM at once; when the
// live position drifts within `margin` items of either edge, the window is
// silently rebuilt centred on the current tick (scroll position preserved,
// so nothing visibly jumps) – this is what makes scrolling feel endless
// without ever materializing more than a few hundred items.
//
// `onSettle(tick)` fires once, ~WHEEL_SETTLE_MS after scrolling stops. A
// `goTo(tick, smooth, silent)` call marked `silent` (used when this wheel is
// just cosmetically following a change made on the *other* wheel) is not
// itself a value change, so its settle is swallowed entirely – it neither
// re-fires onSettle nor cascades into syncing the other wheel again.
function createInfiniteWheel(el, { formatTick, windowSize, margin, initialTick, onSettle }) {
    let windowStart = 0;
    let currentTick = initialTick;
    let items = [];
    let suppressUntil = 0;

    function build() {
        el.innerHTML = '';
        items = [];
        for (let k = 0; k < windowSize; k++) {
            const item = document.createElement('div');
            item.className = 'wheel-item';
            item.style.width = WHEEL_ITEM_WIDTH + 'px';
            item.textContent = formatTick(windowStart + k);
            el.appendChild(item);
            items.push(item);
        }
    }

    function syncPadding() {
        const pad = Math.max(0, el.clientWidth / 2 - WHEEL_ITEM_WIDTH / 2);
        el.style.paddingLeft = el.style.paddingRight = pad + 'px';
    }
    window.addEventListener('resize', syncPadding);

    function localIndexAt(scrollLeft) { return Math.round(scrollLeft / WHEEL_ITEM_WIDTH); }

    function highlight(localIdx) {
        items.forEach((it, idx) => it.classList.toggle('selected', idx === localIdx));
    }

    function recenter(tick, smooth) {
        windowStart = tick - Math.floor(windowSize / 2);
        build();
        syncPadding();
        currentTick = tick;
        el.scrollTo({ left: (tick - windowStart) * WHEEL_ITEM_WIDTH, behavior: smooth ? 'smooth' : 'instant' });
        highlight(tick - windowStart);
    }

    // Repositions to `tick`. Set `silent` when this is cosmetic (the value
    // didn't actually change – e.g. cross-wheel sync) so the settle this
    // scroll triggers is swallowed instead of re-firing onSettle.
    function goTo(tick, smooth, silent) {
        if (silent) suppressUntil = Date.now() + WHEEL_SETTLE_MS + 100;
        syncPadding();
        const localIdx = tick - windowStart;
        if (localIdx < margin || localIdx > windowSize - margin) {
            recenter(tick, smooth);
        } else {
            currentTick = tick;
            el.scrollTo({ left: localIdx * WHEEL_ITEM_WIDTH, behavior: smooth ? 'smooth' : 'instant' });
            highlight(localIdx);
        }
    }

    let settleTimer = null;
    el.addEventListener('scroll', () => {
        const localIdx = localIndexAt(el.scrollLeft);
        highlight(localIdx);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            const tick = windowStart + localIndexAt(el.scrollLeft);
            currentTick = tick;
            const li = tick - windowStart;
            if (li < margin || li > windowSize - margin) recenter(tick, false);
            if (Date.now() >= suppressUntil) onSettle(tick);
        }, WHEEL_SETTLE_MS);
    });

    // Desktop mouse wheel: vertical wheel motion scrubs the horizontal strip.
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        el.scrollLeft += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    }, { passive: false });

    // Mouse drag-to-scrub (touch/pen keep native momentum scrolling, which
    // already handles swipe – only the mouse needs manual panning here).
    let dragging = false, startX = 0, startScroll = 0;
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        dragging = true;
        startX = e.clientX;
        startScroll = el.scrollLeft;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        el.scrollLeft = startScroll - (e.clientX - startX);
    });
    // The visual snap (goTo) happens immediately; onSettle – and whatever it
    // triggers (recompute) – only fires once via the scroll listener above,
    // WHEEL_SETTLE_MS after things actually stop moving.
    function endDrag() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        const tick = windowStart + localIndexAt(el.scrollLeft);
        goTo(tick, true);
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    // Keyboard access (uses currentTick, not live scrollLeft, so key repeat
    // steps reliably even while the previous smooth-scroll is still animating).
    el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(currentTick - 1, true); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentTick + 1, true); }
    });

    recenter(initialTick, false);

    return { goTo };
}

// Like createInfiniteWheel, but for a sequence whose items aren't evenly
// spaced (here: only daylight instants exist, so plain tick arithmetic
// doesn't apply). Navigation happens purely through the caller-supplied
// `stepForward`/`stepBackward` over opaque `pos` objects, and `posForDate`
// resolves an arbitrary target Date to the nearest valid position – the same
// windowed/self-recentring approach as createInfiniteWheel otherwise.
function createSequenceWheel(el, { windowSize, margin, formatPos, stepForward, stepBackward, posForDate, initialPos, onSettle }) {
    let windowPositions = [];
    let currentLocalIndex = 0;
    let items = [];
    let suppressUntil = 0;

    function buildWindowAround(pos) {
        const half = Math.floor(windowSize / 2);
        let p = pos;
        for (let i = 0; i < half; i++) p = stepBackward(p);
        const positions = [];
        for (let i = 0; i < windowSize; i++) { positions.push(p); p = stepForward(p); }
        return positions;
    }

    function build() {
        el.innerHTML = '';
        items = windowPositions.map(pos => {
            const item = document.createElement('div');
            item.className = 'wheel-item';
            item.style.width = WHEEL_ITEM_WIDTH + 'px';
            item.textContent = formatPos(pos);
            el.appendChild(item);
            return item;
        });
    }

    function syncPadding() {
        const pad = Math.max(0, el.clientWidth / 2 - WHEEL_ITEM_WIDTH / 2);
        el.style.paddingLeft = el.style.paddingRight = pad + 'px';
    }
    window.addEventListener('resize', syncPadding);

    function localIndexAt(scrollLeft) {
        return Math.max(0, Math.min(windowSize - 1, Math.round(scrollLeft / WHEEL_ITEM_WIDTH)));
    }

    function highlight(idx) {
        items.forEach((it, i) => it.classList.toggle('selected', i === idx));
    }

    function recenter(pos, smooth) {
        windowPositions = buildWindowAround(pos);
        currentLocalIndex = Math.floor(windowSize / 2);
        build();
        syncPadding();
        el.scrollTo({ left: currentLocalIndex * WHEEL_ITEM_WIDTH, behavior: smooth ? 'smooth' : 'instant' });
        highlight(currentLocalIndex);
    }

    function goToLocal(idx, smooth) {
        if (idx < margin || idx > windowSize - margin) {
            recenter(windowPositions[idx], smooth);
        } else {
            currentLocalIndex = idx;
            el.scrollTo({ left: idx * WHEEL_ITEM_WIDTH, behavior: smooth ? 'smooth' : 'instant' });
            highlight(idx);
        }
    }

    // Repositions to the nearest valid item for `date`. `silent` marks this as
    // cosmetic (the other wheel driving this one) so its settle is swallowed.
    function goToDate(date, smooth, silent) {
        if (silent) suppressUntil = Date.now() + WHEEL_SETTLE_MS + 100;
        recenter(posForDate(date), smooth);
    }

    let settleTimer = null;
    el.addEventListener('scroll', () => {
        const idx = localIndexAt(el.scrollLeft);
        highlight(idx);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            const li = localIndexAt(el.scrollLeft);
            currentLocalIndex = li;
            if (li < margin || li > windowSize - margin) recenter(windowPositions[li], false);
            if (Date.now() >= suppressUntil) onSettle(windowPositions[currentLocalIndex]);
        }, WHEEL_SETTLE_MS);
    });

    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        el.scrollLeft += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    }, { passive: false });

    let dragging = false, startX = 0, startScroll = 0;
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        dragging = true;
        startX = e.clientX;
        startScroll = el.scrollLeft;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        el.scrollLeft = startScroll - (e.clientX - startX);
    });
    function endDrag() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        goToLocal(localIndexAt(el.scrollLeft), true);
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); goToLocal(Math.max(0, currentLocalIndex - 1), true); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goToLocal(Math.min(windowSize - 1, currentLocalIndex + 1), true); }
    });

    recenter(initialPos, false);

    return { goToDate };
}

(function initDateTimeControls() {
    const dateEl = document.getElementById('date-wheel');
    const timeEl = document.getElementById('time-wheel');

    function formatDateTick(t) { const d = dateFromDayTick(t); return MONTH_SHORT[d.getMonth()] + d.getDate(); }

    // Sun-filtered day lists for the time wheel: for each calendar day, every
    // 5-min-aligned instant within [sunrise, sunset + SUNSET_BUFFER_MIN] – the
    // exact set of times the time wheel should ever show. Cached per day since
    // it needs a SunCalc call + the map's current centre, not free to redo on
    // every scroll tick. positions are {day, idx} into that day's list.
    const dayListCache = new Map();
    function sunDayList(dayTick) {
        if (dayListCache.has(dayTick)) return dayListCache.get(dayTick);
        const centre = map.getCenter();
        // Local noon, not midnight: SunCalc buckets by the date's UTC calendar
        // day, and local midnight in CET/CEST (UTC+1/+2) is still "yesterday"
        // in UTC, which silently computed the wrong day's sunrise/sunset.
        const dayNoon = new Date(dateFromDayTick(dayTick).getTime() + 12 * 3600000);
        const times   = SunCalc.getTimes(dayNoon, centre.lat, centre.lng);
        const list = [];
        if (times.sunrise && times.sunset && !isNaN(times.sunrise) && !isNaN(times.sunset)) {
            const end = new Date(times.sunset.getTime() + SUNSET_BUFFER_MIN * 60000);
            for (let t = roundUpToStep(times.sunrise, TIME_STEP_MIN); t <= end; t = new Date(t.getTime() + TICK_MS)) {
                list.push(t);
            }
        }
        if (list.length === 0) list.push(roundUpToStep(dateFromDayTick(dayTick), TIME_STEP_MIN)); // guard; not expected at CH latitudes
        dayListCache.set(dayTick, list);
        return list;
    }
    function timeDateAt(pos) { return sunDayList(pos.day)[pos.idx]; }
    function timeStepForward(pos) {
        if (pos.idx + 1 < sunDayList(pos.day).length) return { day: pos.day, idx: pos.idx + 1 };
        return { day: pos.day + 1, idx: 0 };
    }
    function timeStepBackward(pos) {
        if (pos.idx - 1 >= 0) return { day: pos.day, idx: pos.idx - 1 };
        const prevDay = pos.day - 1;
        return { day: prevDay, idx: sunDayList(prevDay).length - 1 };
    }
    // Nearest valid (daylight) instant to an arbitrary target Date – used
    // whenever a time might land in what's now a hidden night gap (e.g. the
    // date wheel jumping to a day whose daylight window has shifted).
    function timePosFor(target) {
        const day = dayTickFromDate(target);
        const list = sunDayList(day);
        let best = { day, idx: 0 }, bestDiff = Math.abs(list[0] - target);
        for (let i = 1; i < list.length; i++) {
            const diff = Math.abs(list[i] - target);
            if (diff < bestDiff) { bestDiff = diff; best = { day, idx: i }; }
        }
        if (target < list[0]) {
            const prev = timeStepBackward({ day, idx: 0 });
            if (Math.abs(timeDateAt(prev) - target) < bestDiff) return prev;
        }
        if (target > list[list.length - 1]) {
            const next = timeStepForward({ day, idx: list.length - 1 });
            if (Math.abs(timeDateAt(next) - target) < bestDiff) return next;
        }
        return best;
    }

    // selectedDateTime may currently be a night-time value (e.g. the raw
    // "now rounded up" at page load) – snap it into the daylight window right
    // away so both wheels' initial positions agree with the actual state.
    selectedDateTime = timeDateAt(timePosFor(selectedDateTime));

    const dateWheel = createInfiniteWheel(dateEl, {
        formatTick: formatDateTick,
        windowSize: 121, margin: 20,             // ~4 months in view, resyncs ~3 weeks before either edge
        initialTick: dayTickFromDate(selectedDateTime),
        onSettle: (t) => {
            const picked = dateFromDayTick(t);
            const candidate = new Date(selectedDateTime);
            candidate.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            selectedDateTime = timeDateAt(timePosFor(candidate)); // snap into daylight if needed
            syncTimeWheelToSelected(true);
            maybeAutoRecompute();
        }
    });

    const timeWheel = createSequenceWheel(timeEl, {
        windowSize: 600, margin: 150,            // ~4 days of daylight in view, resyncs ~1 day before either edge
        formatPos: pos => { const d = timeDateAt(pos); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; },
        stepForward: timeStepForward,
        stepBackward: timeStepBackward,
        posForDate: timePosFor,
        initialPos: timePosFor(selectedDateTime),
        onSettle: (pos) => {
            selectedDateTime = timeDateAt(pos);
            syncDateWheelToSelected(true);
            maybeAutoRecompute();
        }
    });

    function syncDateWheelToSelected(silent) { dateWheel.goTo(dayTickFromDate(selectedDateTime), false, silent); }
    function syncTimeWheelToSelected(silent) { timeWheel.goToDate(selectedDateTime, false, silent); }

    function maybeAutoRecompute() {
        if (currentMode === 'shadow' && tilesReady) computeShadow();
    }

    // The wheels are created while section-shad is display:none (0 width), so
    // their padding/scroll position need fixing up the first time it's shown.
    window.resyncDateTimeWheels = function() {
        syncDateWheelToSelected(true);
        syncTimeWheelToSelected(true);
    };

    function jumpToNow() {
        selectedDateTime = timeDateAt(timePosFor(roundUpToStep(new Date(), TIME_STEP_MIN)));
        syncDateWheelToSelected(true);
        syncTimeWheelToSelected(true);
        maybeAutoRecompute();
    }
    onDoubleTapOrClick(dateEl, jumpToNow);
    onDoubleTapOrClick(timeEl, jumpToNow);
})();
