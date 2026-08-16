// terrain_app.js – main application logic

// ---------------------------------------------------------------------------
// i18n – all user-facing text lives here as {en, de}. Worker progress
// messages are looked up by key too (see viewshed_worker.js/shade_worker.js,
// which post a key rather than literal text), so switching language mid­
// computation re-renders the current status correctly instead of only
// affecting the next message.
// ---------------------------------------------------------------------------
const STRINGS = {
    en: {
        downloadTiles: 'Download Elevation Data',
        onboardingBubble: 'Start by downloading the elevation data — only required once (approx. 450 MB, 2 min). When visiting again, it will only take a few seconds to load!',
        closeLabel: 'Close',
        feedbackButton: 'Feedback',
        feedbackHeading: 'Send Feedback',
        feedbackMessagePlaceholder: 'Your message…',
        feedbackEmailPlaceholder: 'Your email (optional, so I can reply)',
        feedbackSubmit: 'Send',
        feedbackThanks: 'Thanks for your feedback!',
        feedbackError: 'Something went wrong — please try again, or email manuel.murbach@gmail.com directly.',
        tilesReadyLabel: 'Ready',
        tilesCached: 'Tiles cached: {count}',
        downloadingTiles: 'Downloading {done}/{total}…',
        modeVisibilityBold: 'Peak', modeVisibilitySuffix: ' Visible From',
        modeShadowBold: 'Sun', modeShadowSuffix: ' Visible From',
        pickPeakLabel: 'Click the map, or pick a peak',
        choosePeak: 'Choose a peak…',
        mapClickOption: 'Clicked on map',
        noPeakSelected: 'No peak selected',
        detectedOnCompute: 'Elevation…',
        dateTimeLabel: 'Date & Time (your local time)',
        wheelHint: 'Swipe, drag or scroll a wheel to change it. Double-tap/click to jump to now.',
        idle: '',
        cancel: 'Cancel',
        clearOverlay: 'Clear Overlay',
        legendVis: 'Peak visible from here',
        legendShadow: 'In shadow',
        footerElevation: 'Elevation:',
        footerBasemap: 'Basemap:',
        panelToggle: 'Toggle panel',
        showMyLocation: 'Show my location',
        selectedPeakPopup: 'Selected peak',
        yourLocationPopup: 'Your location',
        lonSuffix: 'E',
        startingViewshed: 'Starting viewshed…',
        loadingTiles: 'Loading tiles {done}/{total}…',
        errorLoadingTiles: 'Error loading tiles: {message}',
        tilesLoadedComputingViewshed: 'Tiles loaded – computing viewshed…',
        tilesLoadedComputingShadows: 'Tiles loaded – computing shadows…',
        computingViewshed: 'Computing viewshed…',
        renderingOverlay: 'Rendering overlay…',
        computingShadows: 'Computing shadows…',
        doneViewshed: 'Done. Peak elevation: {elev} m (auto-detected from DEM + 50 m buffer)',
        doneShadow: 'Done. Sun: {az}° az, {alt}° alt',
        sunLoadingTiles: 'Sun: {az}° az, {alt}° alt – loading tiles…',
        sunBelowHorizon: 'Sun is below the horizon – everything is in shadow.',
        workerError: 'Error: {message}',
        workerFatalError: 'Worker error: {message} (see browser console F12)',
        cancelled: 'Cancelled.',
        locating: 'Locating…',
        located: 'Located your position.',
        locateError: 'Could not get your location: {message}',
        geoUnsupported: 'Geolocation is not supported on this device.',
    },
    de: {
        downloadTiles: 'Höhendaten laden',
        onboardingBubble: 'Starte mit dem Herunterladen der Höhendaten – nur einmalig nötig (ca. 450 MB, 2 Min.). Bei einem erneuten Besuch dauert das Laden nur noch wenige Sekunden!',
        closeLabel: 'Schliessen',
        feedbackButton: 'Feedback',
        feedbackHeading: 'Feedback senden',
        feedbackMessagePlaceholder: 'Deine Nachricht…',
        feedbackEmailPlaceholder: 'Deine E-Mail (optional, für eine Antwort)',
        feedbackSubmit: 'Senden',
        feedbackThanks: 'Danke für dein Feedback!',
        feedbackError: 'Etwas ist schiefgelaufen – bitte versuche es erneut oder schreibe direkt an manuel.murbach@gmail.com.',
        tilesReadyLabel: 'Bereit',
        tilesCached: 'Kacheln gespeichert: {count}',
        downloadingTiles: 'Lade herunter {done}/{total}…',
        modeVisibilityBold: 'Gipfel', modeVisibilitySuffix: ' sichtbar von',
        modeShadowBold: 'Sonne', modeShadowSuffix: ' sichtbar von',
        pickPeakLabel: 'Klicke auf die Karte oder wähle einen Gipfel',
        choosePeak: 'Gipfel wählen…',
        mapClickOption: 'Auf Karte geklickt',
        noPeakSelected: 'Kein Gipfel ausgewählt',
        detectedOnCompute: 'Höhe…',
        dateTimeLabel: 'Datum & Zeit (deine Ortszeit)',
        wheelHint: 'Wische, ziehe oder scrolle an einem Rad, um es zu ändern. Doppeltippen/-klicken springt zu jetzt.',
        idle: '',
        cancel: 'Abbrechen',
        clearOverlay: 'Overlay löschen',
        legendVis: 'Gipfel ist von hier sichtbar',
        legendShadow: 'Im Schatten',
        footerElevation: 'Höhe:',
        footerBasemap: 'Kartenbasis:',
        panelToggle: 'Bedienfeld ein-/ausblenden',
        showMyLocation: 'Meinen Standort anzeigen',
        selectedPeakPopup: 'Ausgewählter Gipfel',
        yourLocationPopup: 'Dein Standort',
        lonSuffix: 'O',
        startingViewshed: 'Sichtbarkeitsberechnung wird gestartet…',
        loadingTiles: 'Lade Kacheln {done}/{total}…',
        errorLoadingTiles: 'Fehler beim Laden der Kacheln: {message}',
        tilesLoadedComputingViewshed: 'Kacheln geladen – berechne Sichtbarkeit…',
        tilesLoadedComputingShadows: 'Kacheln geladen – berechne Schatten…',
        computingViewshed: 'Berechne Sichtbarkeit…',
        renderingOverlay: 'Zeichne Overlay…',
        computingShadows: 'Berechne Schatten…',
        doneViewshed: 'Fertig. Gipfelhöhe: {elev} m (automatisch erkannt aus DEM + 50 m Puffer)',
        doneShadow: 'Fertig. Sonne: {az}° Az, {alt}° Höhe',
        sunLoadingTiles: 'Sonne: {az}° Az, {alt}° Höhe – lade Kacheln…',
        sunBelowHorizon: 'Die Sonne steht unter dem Horizont – alles liegt im Schatten.',
        workerError: 'Fehler: {message}',
        workerFatalError: 'Worker-Fehler: {message} (siehe Browser-Konsole F12)',
        cancelled: 'Abgebrochen.',
        locating: 'Standort wird ermittelt…',
        located: 'Standort gefunden.',
        locateError: 'Standort konnte nicht ermittelt werden: {message}',
        geoUnsupported: 'Geolokalisierung wird auf diesem Gerät nicht unterstützt.',
    },
};

let lang = localStorage.getItem('vf_lang') ||
    (navigator.language && navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en');

function t(key, params) {
    let str = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
    if (params) for (const k in params) str = str.replace(`{${k}}`, params[k]);
    return str;
}

// Geographic coordinate formatting – German uses N/O (Nord/Ost), English N/E.
function fmtCoord(lat, lon) {
    return `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° ${t('lonSuffix')}`;
}

const TILE_BASE_URL = 'cache/tiles';
const ZOOM = 12; // must match ZOOM in dem_math.js
const TILE_SIZE = 256;
const TILE_CONCURRENCY = 12; // parallel tile fetches; compute is fast, loading is now the bottleneck

// ---------------------------------------------------------------------------
// Fixed analysis quality – always maximum, subject to the memory-safety cap
// in chooseMosaicSubsample() (see loadMosaic above).
// maxRangeKm  – viewshed radius (also limits tile loading area)
// outSize     – longest edge of the output overlay image (px)
// shadowStepM – shadow ray step size (m); smaller = sharper shadows, slower
// shadowOutSize – longest edge of shadow overlay image (px)
// ---------------------------------------------------------------------------
const CONFIG = {
    maxRangeKm: 300, outSize: 2048, shadowStepM: 30, shadowOutSize: 1536,
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

// Set by the "Clear Overlay" button: once true, every *passive* auto-
// recompute path (mode switch, pan/zoom in shadow mode) is skipped, so the
// map stays genuinely clear instead of the overlay immediately reappearing
// from whatever conditions were already true. Only cleared again by a
// deliberate new trigger - picking a peak (map click or preset) or
// scrubbing the date/time wheel - which is exactly the set of actions that
// already meant "give me a fresh result" everywhere else in the app.
let overlaySuppressed = false;

// Nothing computes until the Switzerland-wide DEM tile download has
// completed at least once – this guarantees a computation never triggers a
// fresh network fetch (both compute tile ranges are clamped to exactly the
// area this download covers).
let tilesReady = false;

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
const tileCache = new Map(); // `${z}_${x}_${y}` -> Int16Array(256*256), in-memory only

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

// Elevations are stored as whole metres (Int16Array, not Float32Array) – half
// the memory of the full-precision decode, and sub-metre precision doesn't
// matter for line-of-sight/shadow math over the km-scale distances this app
// deals with. This matters a lot here: the tile cache and compute mosaics
// are large enough (see MAX_MOSAIC_CELLS below) that the factor-of-2 saving
// is the difference between fitting in an iPhone Safari tab and not.
function decodeTilePng(blob) {
    return createImageBitmap(blob).then(bitmap => {
        _decCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
        _decCtx.drawImage(bitmap, 0, 0);
        const { data } = _decCtx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
        const elev = new Int16Array(TILE_SIZE * TILE_SIZE);
        for (let i = 0; i < elev.length; i++)
            elev[i] = Math.round((data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256) - 32768);
        return elev;
    });
}

// Load one DEM tile and return an Int16Array[256×256] of elevations.
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

// A compute mosaic covering the whole of Switzerland+padding at native
// resolution (subsample=1) is ~17000×14000 px – a ~460 MB Int16Array, built
// fresh on *every* Compute click on top of the already-cached tiles. That
// spike is what was crashing the app on iPhone shortly after pressing
// Compute (Safari's per-tab memory limit is far below desktop). Since
// maxRangeKm (300, needed for genuinely distant peaks like Mont Blanc) is
// larger than Switzerland itself, almost every viewshed/shadow tile range
// clamps to that near-full-country size, so this isn't an edge case – it's
// the common case.
//
// The fix: never materialize the full-resolution mosaic at all. Pick a
// downsample step (always a divisor of TILE_SIZE, so tile boundaries stay
// pixel-aligned with no seams) that keeps the mosaic under a fixed cell
// budget, and decimate straight from each decoded tile while compositing.
// The final overlay image is capped at outSize/shadowOutSize px anyway
// (≤2048), so a coarser compute grid for country-scale ranges is not
// visible in the result – it only removes wasted memory.
const MOSAIC_SUBSAMPLE_STEPS = [1, 2, 4, 8, 16, 32, 64]; // all divide TILE_SIZE evenly
const MAX_MOSAIC_CELLS = 16_000_000; // ≈32 MB Int16 elev + ≈16 MB Uint8 visible – safe on mobile

function chooseMosaicSubsample(cols, rows) {
    const fullCells = cols * TILE_SIZE * rows * TILE_SIZE;
    for (const step of MOSAIC_SUBSAMPLE_STEPS)
        if (fullCells / (step * step) <= MAX_MOSAIC_CELLS) return step;
    return MOSAIC_SUBSAMPLE_STEPS[MOSAIC_SUBSAMPLE_STEPS.length - 1];
}

// Load all tiles covering [xtMin..xtMax] × [ytMin..ytMax] and stitch into a
// single Int16Array mosaic, downsampled (see chooseMosaicSubsample) so its
// size never depends on how large the requested tile range is. Calls
// onProgress(done, total) periodically. The returned `subsample` tells the
// workers how many native DEM pixels each mosaic cell represents.
async function loadMosaic(xtMin, xtMax, ytMin, ytMax, onProgress) {
    const cols = xtMax - xtMin + 1;
    const rows = ytMax - ytMin + 1;
    const step = chooseMosaicSubsample(cols, rows);
    const pw   = (cols * TILE_SIZE) / step;
    const ph   = (rows * TILE_SIZE) / step;
    const destTileSpan = TILE_SIZE / step;

    const mosaic = new Int16Array(pw * ph); // zero = sea level fallback

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
                const destColOff = ((tx - xtMin) * TILE_SIZE) / step;
                const destRowOff = ((ty - ytMin) * TILE_SIZE) / step;
                if (step === 1) {
                    for (let r = 0; r < TILE_SIZE; r++) {
                        const mosaicRow = (destRowOff + r) * pw + destColOff;
                        mosaic.set(tileElev.subarray(r * TILE_SIZE, (r + 1) * TILE_SIZE), mosaicRow);
                    }
                } else {
                    for (let r = 0; r < destTileSpan; r++) {
                        const destBase = (destRowOff + r) * pw + destColOff;
                        const srcRowBase = (r * step) * TILE_SIZE;
                        for (let c = 0; c < destTileSpan; c++)
                            mosaic[destBase + c] = tileElev[srcRowBase + c * step];
                    }
                }
            }
            done++;
            if (onProgress) onProgress(done, tilesToLoad.length);
        }
    }

    const workerCount = Math.min(TILE_CONCURRENCY, tilesToLoad.length);
    await Promise.all(Array.from({ length: workerCount }, fetchWorker));

    return { elev: mosaic, pw, ph, xtMin, ytMin, xtMax, ytMax, subsample: step };
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

// Auto-recompute the shadow map on pan/zoom in shadow mode, so the overlay
// always matches the viewport without needing a manual re-click of Compute
// (mirrors the existing auto-recompute when the date/time wheel settles).
// Debounced so a burst of moveend events from a drag or a multi-step zoom
// only triggers one recompute, once the view actually settles.
let shadowRecomputeTimer = null;
map.on('moveend', () => {
    if (currentMode !== 'shadow' || !tilesReady || overlaySuppressed) return;
    clearTimeout(shadowRecomputeTimer);
    shadowRecomputeTimer = setTimeout(computeShadow, 400);
});

// ---------------------------------------------------------------------------
// "My location" map control – sits below the zoom +/- buttons (same corner,
// Leaflet stacks same-position controls automatically). Just centres the map
// on the device's GPS position and drops a marker there; it doesn't select
// a peak on its own – click the map (or the marker) afterwards for that.
// ---------------------------------------------------------------------------

let locationMarker = null;

function locateMe() {
    if (!navigator.geolocation) {
        setStatus('geoUnsupported', null, 0);
        return;
    }
    setStatus('locating', null, 0);
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            if (locationMarker) map.removeLayer(locationMarker);
            locationMarker = L.circleMarker([lat, lon], {
                radius: 8, color: '#fff', weight: 2, fillColor: '#1d4ed8', fillOpacity: 1
            })
                .addTo(map)
                .bindPopup(`<b>${t('yourLocationPopup')}</b><br>${fmtCoord(lat, lon)}`)
                .openPopup();
            map.setView([lat, lon], Math.max(map.getZoom(), 13));
            setStatus('located', null, 0);
        },
        (err) => setStatus('locateError', { message: err.message }, 0),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

let locateControlLink = null;

const LocateControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.setAttribute('role', 'button');
        link.innerHTML =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" style="vertical-align:middle"><circle cx="12" cy="12" r="3"/>' +
            '<line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>' +
            '<line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
        L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', locateMe);
        locateControlLink = link;
        return container;
    }
});
map.addControl(new LocateControl());

// A map control (stacked below zoom/locate) rather than a small footer
// link, since the footer link was easy to miss - blue-accented (see CSS)
// so it reads as an inviting action, not just another neutral map tool.
let feedbackControlLink = null;

const FeedbackControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control feedback-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.setAttribute('role', 'button');
        link.innerHTML =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">' +
            '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
            '</svg>';
        L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', openFeedbackModal);
        feedbackControlLink = link;
        return container;
    }
});
map.addControl(new FeedbackControl());

// ---------------------------------------------------------------------------
// Legend – a Leaflet control over the map's top-right corner instead of a
// sidebar section, so it sits right next to the overlay it describes
// regardless of panel/sheet state. pointer-events:none (see CSS) keeps it
// from intercepting map clicks.
// ---------------------------------------------------------------------------

let mapLegendEl = null;
let currentLegendKind = null; // 'vis' | 'shadow' | null, for re-translating on language switch

const LEGEND_SWATCH = {
    vis: 'rgba(12,130,45,0.86)',
    shadow: 'rgba(20,20,60,0.55)',
};

const MapLegendControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
        const el = L.DomUtil.create('div', 'map-legend');
        el.innerHTML = '<span class="map-legend-swatch"></span><span class="map-legend-text"></span>';
        mapLegendEl = el;
        return el;
    }
});
map.addControl(new MapLegendControl());

function showMapLegend(kind) {
    currentLegendKind = kind;
    if (!mapLegendEl) return;
    mapLegendEl.querySelector('.map-legend-swatch').style.background = LEGEND_SWATCH[kind];
    mapLegendEl.querySelector('.map-legend-text').textContent = t(kind === 'vis' ? 'legendVis' : 'legendShadow');
    mapLegendEl.style.display = 'flex';
}

function hideMapLegend() {
    currentLegendKind = null;
    if (mapLegendEl) mapLegendEl.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

// Peak/Sun can't do anything useful until the elevation data is downloaded
// (computeViewshed/computeShadow both just no-op without it), so keep them
// visibly disabled until then rather than letting people click into a mode
// with nothing to show yet.
function updateModeButtonsAvailability() {
    document.getElementById('btn-visibility').disabled = !tilesReady;
    document.getElementById('btn-shadow').disabled = !tilesReady;
}
updateModeButtonsAvailability();

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-visibility').classList.toggle('active', mode === 'visibility');
    document.getElementById('btn-shadow').classList.toggle('active', mode === 'shadow');
    document.getElementById('section-vis').style.display  = mode === 'visibility' ? 'flex' : 'none';
    document.getElementById('section-shad').style.display = mode === 'shadow'     ? 'flex' : 'none';
    if (mode === 'shadow' && window.resyncDateTimeWheels) window.resyncDateTimeWheels();

    // The other mode's overlay would otherwise linger on screen looking like
    // it belongs to the mode just switched into (most noticeable switching
    // into visibility mode with no peak selected yet, which has nothing to
    // auto-compute below).
    clearOverlay();

    if (!tilesReady || overlaySuppressed) return;
    if (mode === 'visibility' && selectedPeak) computeViewshed();
    if (mode === 'shadow') computeShadow();
}
window.setMode = setMode;

// ---------------------------------------------------------------------------
// Mobile panel toggle – on narrow screens (see CSS) the panel becomes a
// bottom sheet instead of a permanent sidebar, so the map is usable.
// ---------------------------------------------------------------------------

// Mirrors the panel's own open/closed state onto <body> so CSS elsewhere
// (the #map height shrink, the progress bar's position) can react to it
// without needing a same-or-later-sibling relationship to #panel itself.
function togglePanel() {
    const isOpen = document.getElementById('panel').classList.toggle('open');
    document.getElementById('panel-toggle').classList.toggle('open', isOpen);
    document.body.classList.toggle('panel-open', isOpen);
    // #map's resize is CSS-only (a transition on `height`), and Leaflet
    // doesn't detect that on its own - it keeps using its last-known
    // container size for pan bounds/rendering until told otherwise, which
    // is exactly what let you drag past the "visible" area into whatever
    // was hidden under the sheet. Called once after the resize transition
    // finishes so it picks up the final size, not a mid-transition one.
    setTimeout(() => map.invalidateSize(), 260);
}
window.togglePanel = togglePanel;
// Match <body>'s initial class to the panel's actual starting state (open,
// per the markup) rather than assuming it, and invalidate immediately -
// Leaflet measured #map's size at L.map() init time above, which (on
// mobile) was before this class/the #map height shrink took effect, so
// its cached size starts out stale/full-height without this.
document.body.classList.toggle('panel-open', document.getElementById('panel').classList.contains('open'));
map.invalidateSize();

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
    if (wasRunning) setStatus('idle', null, 0);
}

function onMapClick(e) {
    if (currentMode !== 'visibility') return;
    const { lat, lng } = e.latlng;
    abandonInFlightViewshed();
    selectedPeak = { lat, lon: lng };
    overlaySuppressed = false; // picking a new location is a deliberate new trigger

    if (visMarker) map.removeLayer(visMarker);
    visMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<b>${t('selectedPeakPopup')}</b><br>${fmtCoord(lat, lng)}`)
        .openPopup();

    document.getElementById('vis-coords').textContent = fmtCoord(lat, lng);
    document.getElementById('peak-elev').value = '';
    // Otherwise the dropdown keeps showing whatever preset was last picked
    // (e.g. "Mont Blanc") even though the actual selection has moved to
    // wherever was just clicked.
    document.getElementById('peak-select').value = '__map_click__';
    if (tilesReady) computeViewshed();
}

// ---------------------------------------------------------------------------
// Preset peak buttons
// ---------------------------------------------------------------------------

function selectPreset(key) {
    const peak = PEAK_PRESETS[key];
    if (!peak) return;

    abandonInFlightViewshed();
    selectedPeak = { lat: peak.lat, lon: peak.lon };
    overlaySuppressed = false; // picking a new location is a deliberate new trigger

    if (visMarker) map.removeLayer(visMarker);
    visMarker = L.marker([peak.lat, peak.lon])
        .addTo(map)
        .bindPopup(`<b>${peak.name}</b><br>${fmtCoord(peak.lat, peak.lon)}, ${peak.elev} m`)
        .openPopup();

    document.getElementById('vis-coords').textContent =
        `${peak.name} — ${fmtCoord(peak.lat, peak.lon)}`;
    document.getElementById('peak-elev').value = '';
    if (tilesReady) computeViewshed();

    map.setView([peak.lat, peak.lon], map.getZoom());
}
window.selectPreset = selectPreset;

// ---------------------------------------------------------------------------
// Status & progress
// ---------------------------------------------------------------------------

// Stores the last status shown (as a key+params, not the rendered string) so
// applyTranslations() can re-render it correctly if the language is switched
// mid-computation, instead of only affecting the *next* status message.
let currentStatusKey = 'idle';
let currentStatusParams = null;

function setStatus(key, params, pct) {
    currentStatusKey = key;
    currentStatusParams = params;
    document.getElementById('status').textContent = t(key, params);
    if (pct != null) {
        const fill = document.getElementById('top-progress-fill');
        fill.style.width = Math.round(pct) + '%';
        // Briefly show the completed bar, then fade it back to empty rather
        // than leaving a stale full-width bar sitting at the top forever.
        clearTimeout(setStatus._resetTimer);
        if (pct >= 100) setStatus._resetTimer = setTimeout(() => { fill.style.width = '0%'; }, 400);
    }
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
    document.getElementById('btn-cancel').style.display  = 'none';
    setStatus('cancelled', null, 0);
}
window.cancelComputation = cancelComputation;

// Used internally (by setMode when switching modes) so a stale overlay never
// lingers on screen looking like it belongs to whichever mode is now active.
// Does not touch overlaySuppressed - an internal cleanup isn't the user
// asking to stay clear.
function clearOverlay() {
    if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
    hideMapLegend();
}

// Bound to the "Clear Overlay" button - this is the user explicitly asking
// to stay clear, so unlike clearOverlay() it also suppresses further
// passive auto-recompute until a new trigger (peak pick or date/time
// change) explicitly resumes it.
function clearOverlayManually() {
    overlaySuppressed = true;
    clearOverlay();
}
window.clearOverlayManually = clearOverlayManually;

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
    if (el) el.textContent = t('tilesCached', { count: tileCache.size });
    const check = document.getElementById('tile-dl-check');
    if (check) check.style.display = tilesReady ? 'inline' : 'none';
}

async function downloadElevationData() {
    dismissOnboarding();
    const range = getSwitzerlandTileRange();

    // The button itself doubles as the progress bar (see #btn-download-tiles
    // CSS) via a gradient driven by this custom property, instead of a
    // separate progress-bar element – saves a row of height. It's disabled
    // both while downloading (full opacity, via the .downloading class, so
    // the gradient stays legible) and permanently once done (dimmed, via
    // .tiles-ready, since there's nothing left to do with it) - Peak/Sun
    // take over as the actionable buttons once it's greyed out.
    const btn = document.getElementById('btn-download-tiles');
    btn.disabled = true;
    btn.classList.add('downloading');
    btn.style.setProperty('--dl-progress', '0%');

    await prefetchTiles(range.xtMin, range.xtMax, range.ytMin, range.ytMax, (done, total) => {
        document.getElementById('tile-dl-status').textContent = t('downloadingTiles', { done, total });
        btn.style.setProperty('--dl-progress', Math.round((done / total) * 100) + '%');
    });

    btn.classList.remove('downloading');
    btn.classList.add('tiles-ready');
    btn.style.setProperty('--dl-progress', '0%');
    tilesReady = true;
    updateTileCacheLabel();
    updateModeButtonsAvailability();

    // Auto-compute for whichever mode is currently active, so the user sees
    // a result immediately instead of needing any further action. First-time
    // onboarding case: nothing selected yet in visibility mode defaults to
    // Dufourspitze as a working example (selectPreset triggers its own
    // compute once tilesReady, so this doesn't need to call it directly).
    if (currentMode === 'visibility') {
        if (selectedPeak) computeViewshed();
        else {
            document.getElementById('peak-select').value = 'dufourspitze';
            selectPreset('dufourspitze');
        }
    } else if (currentMode === 'shadow') {
        computeShadow();
    }
}
window.downloadElevationData = downloadElevationData;

// ---------------------------------------------------------------------------
// Viewshed computation
// ---------------------------------------------------------------------------

async function computeViewshed() {
    if (!selectedPeak || !tilesReady) return;

    const myToken = ++vsToken; // invalidates any computation already in flight

    showMapLegend('vis');
    document.getElementById('btn-cancel').style.display = 'block';
    setStatus('startingViewshed', null, 0);

    const cfg = CONFIG;

    // Tile range for viewshed area centred on peak
    const lat = selectedPeak.lat, lon = selectedPeak.lon;
    const { xtMin, xtMax, ytMin, ytMax } = getViewshedTileRange(lat, lon);

    console.log('[app] viewshed tile range', { xtMin, xtMax, ytMin, ytMax });

    let mosaic;
    try {
        mosaic = await loadMosaic(xtMin, xtMax, ytMin, ytMax, (done, total) => {
            if (myToken !== vsToken) return; // superseded – ignore
            setStatus('loadingTiles', { done, total }, (done / total) * 30);
        });
    } catch (err) {
        if (myToken !== vsToken) return;
        setStatus('errorLoadingTiles', { message: err.message }, 0);
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    if (myToken !== vsToken) return; // a different peak was selected while tiles were loading

    setStatus('tilesLoadedComputingViewshed', null, 30);

    if (viewshedWorker) viewshedWorker.terminate();
    viewshedWorker = new Worker('viewshed_worker.js');

    viewshedWorker.onerror = function (err) {
        if (myToken !== vsToken) return;
        console.error('[app] viewshed worker error:', err);
        setStatus('workerFatalError', { message: err.message || err }, 0);
        document.getElementById('btn-cancel').style.display = 'none';
    };

    viewshedWorker.onmessage = function (e) {
        if (myToken !== vsToken) return; // superseded – ignore stale result
        const d = e.data;
        if (d.type === 'progress') {
            setStatus(d.key, null, 30 + d.percent * 0.7);
        } else if (d.type === 'result') {
            applyResult(d);
            // " m" suffix here since there's no longer a separate label
            // conveying units (the field's own placeholder + this value are
            // now the only context for what the number means).
            document.getElementById('peak-elev').value = Math.round(d.peakElev) + ' m';
            setStatus('doneViewshed', { elev: Math.round(d.peakElev) }, 100);
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'error') {
            setStatus('workerError', { message: d.message }, 0);
            document.getElementById('btn-cancel').style.display = 'none';
        }
    };

    viewshedWorker.postMessage(
        {
            elev: mosaic.elev.buffer, pw: mosaic.pw, ph: mosaic.ph,
            xtMin, ytMin, xtMax, ytMax,
            peakLat: lat, peakLon: lon,
            subsample: mosaic.subsample, outSize: cfg.outSize
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

    showMapLegend('shadow');
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
        setStatus('sunBelowHorizon', null, 100);
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    setStatus('sunLoadingTiles', { az: sunAzDeg.toFixed(0), alt: sunAltDeg.toFixed(1) }, 0);

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
            setStatus('loadingTiles', { done, total }, (done / total) * 35);
        });
    } catch (err) {
        if (myToken !== shadowToken) return;
        setStatus('errorLoadingTiles', { message: err.message }, 0);
        document.getElementById('btn-cancel').style.display = 'none';
        return;
    }

    if (myToken !== shadowToken) return; // cancelled/superseded while tiles were loading

    setStatus('tilesLoadedComputingShadows', null, 35);

    if (shadowWorker) shadowWorker.terminate();
    shadowWorker = new Worker('shade_worker.js');

    shadowWorker.onerror = function (err) {
        if (myToken !== shadowToken) return;
        console.error('[app] shadow worker error:', err);
        setStatus('workerFatalError', { message: err.message || err }, 0);
        document.getElementById('btn-cancel').style.display = 'none';
    };

    shadowWorker.onmessage = function (e) {
        if (myToken !== shadowToken) return; // superseded – ignore stale result
        const d = e.data;
        if (d.type === 'progress') {
            setStatus(d.key, null, 35 + d.percent * 0.65);
        } else if (d.type === 'result') {
            applyResult(d);
            setStatus('doneShadow', { az: sunAzDeg.toFixed(0), alt: sunAltDeg.toFixed(1) }, 100);
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'allDark') {
            applyResult(makeDarkOverlay(map.getBounds()));
            setStatus('sunBelowHorizon', null, 100);
            document.getElementById('btn-cancel').style.display = 'none';
        } else if (d.type === 'error') {
            setStatus('workerError', { message: d.message }, 0);
            document.getElementById('btn-cancel').style.display = 'none';
        }
    };

    shadowWorker.postMessage(
        {
            elev: mosaic.elev.buffer, pw: mosaic.pw, ph: mosaic.ph,
            xtMin, ytMin, subsample: mosaic.subsample,
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

const MONTHS_SHORT = {
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    de: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
};

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

    // Desktop mouse wheel: vertical wheel motion scrubs the horizontal strip,
    // one item per wheel event regardless of the reported delta magnitude –
    // a single notch of a physical scroll wheel commonly reports a deltaY of
    // 100-150+, which against a 48px item was jumping 2-3 items per notch.
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (delta !== 0) el.scrollLeft += Math.sign(delta) * WHEEL_ITEM_WIDTH;
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

    // Re-renders the currently-built items' labels in place (e.g. after a
    // language switch changes month names) without touching scroll position.
    function refresh() {
        items.forEach((it, idx) => { it.textContent = formatTick(windowStart + idx); });
    }

    return { goTo, refresh };
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

    // One item per wheel event regardless of delta magnitude – see the
    // matching comment in createInfiniteWheel above.
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (delta !== 0) el.scrollLeft += Math.sign(delta) * WHEEL_ITEM_WIDTH;
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

    function refresh() {
        items.forEach((it, idx) => { it.textContent = formatPos(windowPositions[idx]); });
    }

    return { goToDate, refresh };
}

(function initDateTimeControls() {
    const dateEl = document.getElementById('date-wheel');
    const timeEl = document.getElementById('time-wheel');

    function formatDateTick(t) { const d = dateFromDayTick(t); return MONTHS_SHORT[lang][d.getMonth()] + d.getDate(); }

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
        if (currentMode === 'shadow' && tilesReady) {
            overlaySuppressed = false; // changing date/time is a deliberate new trigger
            computeShadow();
        }
    }

    // The wheels are created while section-shad is display:none (0 width), so
    // their padding/scroll position need fixing up the first time it's shown.
    window.resyncDateTimeWheels = function() {
        syncDateWheelToSelected(true);
        syncTimeWheelToSelected(true);
    };

    // Called after a language switch to re-render already-built wheel item
    // labels (month abbreviations) in place, without touching scroll position.
    window.refreshDateTimeWheelLabels = function() {
        dateWheel.refresh();
        timeWheel.refresh();
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

// ---------------------------------------------------------------------------
// Language switch – re-renders every static label, the current status
// message, the date-wheel month names, and the map-control tooltips in the
// active language. Runs once at load (after the IIFE above so the date-wheel
// refresh hook exists) and again whenever the DE/EN toggle is clicked.
// ---------------------------------------------------------------------------

function applyTranslations() {
    document.documentElement.lang = lang;

    document.getElementById('btn-download-tiles').textContent = t('downloadTiles');
    document.getElementById('onboarding-bubble-text').textContent = t('onboardingBubble');
    document.getElementById('onboarding-bubble-close').setAttribute('aria-label', t('closeLabel'));
    document.getElementById('tile-dl-check').setAttribute('aria-label', t('tilesReadyLabel'));
    updateTileCacheLabel();

    // German mode-button labels are long enough that a mid-phrase wrap looks
    // awkward ("Gipfel sichtbar / von") – force the break right after the
    // bold word instead. English fits fine with a natural wrap, so leave it.
    const modeSep = lang === 'de' ? '<br>' : '';
    document.getElementById('btn-visibility').innerHTML =
        `<strong>${t('modeVisibilityBold')}</strong>${modeSep}${t('modeVisibilitySuffix')}`;
    document.getElementById('btn-shadow').innerHTML =
        `<strong>${t('modeShadowBold')}</strong>${modeSep}${t('modeShadowSuffix')}`;

    document.getElementById('label-pick-peak').textContent = t('pickPeakLabel');
    document.getElementById('peak-select-placeholder').textContent = t('choosePeak');
    document.getElementById('peak-select-mapclick').textContent = t('mapClickOption');
    if (!selectedPeak) document.getElementById('vis-coords').textContent = t('noPeakSelected');
    document.getElementById('peak-elev').placeholder = t('detectedOnCompute');

    document.getElementById('label-datetime').textContent = t('dateTimeLabel');
    document.getElementById('wheel-hint').textContent = t('wheelHint');

    document.getElementById('status').textContent = t(currentStatusKey, currentStatusParams);
    document.getElementById('btn-cancel').textContent = t('cancel');
    document.getElementById('btn-clear-overlay').textContent = t('clearOverlay');

    if (currentLegendKind) showMapLegend(currentLegendKind);

    document.getElementById('footer-elevation-label').textContent = t('footerElevation');
    document.getElementById('footer-basemap-label').textContent = t('footerBasemap');

    document.getElementById('feedback-heading').textContent = t('feedbackHeading');
    document.getElementById('feedback-message').placeholder = t('feedbackMessagePlaceholder');
    document.getElementById('feedback-email').placeholder = t('feedbackEmailPlaceholder');
    document.getElementById('feedback-submit-btn').textContent = t('feedbackSubmit');
    document.getElementById('feedback-modal-close').setAttribute('aria-label', t('closeLabel'));

    document.getElementById('panel-toggle').setAttribute('aria-label', t('panelToggle'));
    if (locateControlLink) {
        locateControlLink.title = t('showMyLocation');
        locateControlLink.setAttribute('aria-label', t('showMyLocation'));
    }
    if (feedbackControlLink) {
        feedbackControlLink.title = t('feedbackButton');
        feedbackControlLink.setAttribute('aria-label', t('feedbackButton'));
    }

    if (window.refreshDateTimeWheelLabels) window.refreshDateTimeWheelLabels();

    document.querySelectorAll('#lang-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
}

function setLang(newLang) {
    lang = newLang;
    localStorage.setItem('vf_lang', lang);
    applyTranslations();
}
window.setLang = setLang;

// ---------------------------------------------------------------------------
// Onboarding – a callout pointing at "Download Elevation Data" so new users
// know where to start. Tied to whether the data is actually downloaded
// (tilesReady), not a one-time "seen it" flag – every session starts with
// nothing downloaded, so it should reappear on every reload until the
// download actually completes, not just the very first time ever. The X
// button (or starting the download) only dismisses it for the current
// page view; it comes right back on the next reload if still not
// downloaded, since the thing it's pointing at still needs doing.
// ---------------------------------------------------------------------------

let onboardingDismissedThisSession = false;

function dismissOnboarding() {
    onboardingDismissedThisSession = true;
    const el = document.getElementById('onboarding-bubble');
    if (el) el.style.display = 'none';
}
window.dismissOnboarding = dismissOnboarding;

// Positions the bubble (and its arrow) against the *actual* rendered
// position of "Download Elevation Data", measured via getBoundingClientRect
// rather than a guessed pixel offset – so the arrow genuinely points at the
// button regardless of layout (desktop sidebar vs. mobile two-column row)
// or window size. ARROW_TOP/ARROW_HALF mirror the CSS triangle's geometry.
function positionOnboardingBubble() {
    const bubble = document.getElementById('onboarding-bubble');
    const btn = document.getElementById('btn-download-tiles');
    const arrow = bubble ? bubble.querySelector('.onboarding-bubble-arrow') : null;
    if (!bubble || !btn || !arrow || bubble.style.display === 'none') return;

    const btnRect = btn.getBoundingClientRect();
    const ARROW_HALF = 10;
    const GAP = 14;

    if (window.innerWidth <= 700) {
        // Mobile: bubble sits above the bottom sheet, arrow points down at
        // the button's horizontal centre.
        bubble.style.top = 'auto';
        bubble.style.right = '16px';
        bubble.style.left = '16px';
        const bubbleLeft = 16;
        const arrowLeft = Math.max(16, Math.min(window.innerWidth - 48,
            btnRect.left + btnRect.width / 2 - bubbleLeft - ARROW_HALF));
        arrow.style.left = arrowLeft + 'px';
    } else {
        // Desktop: bubble sits left of the sidebar, arrow points right at
        // the button's vertical centre.
        const ARROW_TOP = 24; // matches .onboarding-bubble-arrow's CSS top
        bubble.style.right = (window.innerWidth - btnRect.left + GAP) + 'px';
        bubble.style.top = (btnRect.top + btnRect.height / 2 - ARROW_TOP - ARROW_HALF) + 'px';
    }
}

function maybeShowOnboarding() {
    if (tilesReady || onboardingDismissedThisSession) return;
    const el = document.getElementById('onboarding-bubble');
    if (el) el.style.display = 'block';
    positionOnboardingBubble();
}

window.addEventListener('resize', () => {
    const el = document.getElementById('onboarding-bubble');
    if (el && el.style.display !== 'none') positionOnboardingBubble();
});

// ---------------------------------------------------------------------------
// Feedback – a small modal that submits via FormSubmit.co's AJAX endpoint
// (https://formsubmit.co/ajax/<email>) rather than a real backend, since
// this is a static site with none. The _honey field is FormSubmit's spam
// honeypot convention: left blank by real users, silently discarded if a
// bot fills it in. The very first submission to a new destination address
// triggers a one-time confirmation email from FormSubmit that has to be
// clicked before further submissions actually get delivered.
// ---------------------------------------------------------------------------

function openFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'flex';
    document.getElementById('feedback-message').focus();
}
window.openFeedbackModal = openFeedbackModal;

function closeFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'none';
}
window.closeFeedbackModal = closeFeedbackModal;

async function submitFeedback(e) {
    e.preventDefault();
    const message = document.getElementById('feedback-message').value.trim();
    if (!message) return;
    const email = document.getElementById('feedback-email').value.trim();
    const submitBtn = document.getElementById('feedback-submit-btn');
    const status = document.getElementById('feedback-status');

    submitBtn.disabled = true;
    status.className = '';
    status.textContent = '';

    try {
        const resp = await fetch('https://formsubmit.co/ajax/manuel.murbach@gmail.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                message,
                email: email || '(not provided)',
                _subject: 'Visible From – Feedback',
                _captcha: 'false',
                language: lang,
                page: location.href,
            }),
        });
        if (!resp.ok) throw new Error('bad response');
        status.textContent = t('feedbackThanks');
        status.className = 'success';
        document.getElementById('feedback-form').reset();
        setTimeout(closeFeedbackModal, 1800);
    } catch (err) {
        status.textContent = t('feedbackError');
        status.className = 'error';
    } finally {
        submitBtn.disabled = false;
    }
}
window.submitFeedback = submitFeedback;

applyTranslations();
maybeShowOnboarding();

// ---------------------------------------------------------------------------
// "Am I looking at the latest deploy?" indicator – fetches the latest commit
// on GitHub at load time rather than baking a version number in at commit
// time (there's no build step to do that reliably), so it can never drift
// out of sync with what's actually live. Fails silently if the API is
// unreachable/rate-limited – this is a nice-to-have, not core functionality.
(async function showAppVersion() {
    const el = document.getElementById('app-version');
    if (!el) return;
    try {
        const resp = await fetch('https://api.github.com/repos/manuelmurbach/visible-from/commits/main');
        if (!resp.ok) return;
        const { sha } = await resp.json();
        el.textContent = sha.slice(0, 7);
        el.href = `https://github.com/manuelmurbach/visible-from/commit/${sha}`;
    } catch (_) { /* offline or rate-limited – leave blank */ }
})();
