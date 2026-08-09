// dem_math.js – loaded via importScripts() by both Web Workers
// Math-only: no canvas, no fetch, no DOM.  Tile decoding is done on the main thread.

const ZOOM = 12;
const TILE_SIZE = 256;
const EARTH_RADIUS = 6371000.0;
const REFRACTION_K = 0.13;
const R_EFF = EARTH_RADIUS / (1.0 - REFRACTION_K); // ~7 323 000 m
const EYE_HEIGHT = 1.7; // observer eye height above terrain (m)

// ---------------------------------------------------------------------------
// Tile math – identical to the Python script
// ---------------------------------------------------------------------------

function latLonToTileFractional(lat, lon, zoom) {
    zoom = zoom || ZOOM;
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    return {
        x: (lon + 180) / 360 * n,
        y: (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n
    };
}

function tileCornerLatLon(tx, ty, zoom) {
    zoom = zoom || ZOOM;
    const n = Math.pow(2, zoom);
    const lon = tx / n * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n)));
    return { lat: latRad * 180 / Math.PI, lon };
}

// Pixel size in metres at a given latitude (Web Mercator – square pixels)
function pixelMetres(lat) {
    return 2 * Math.PI * EARTH_RADIUS * Math.cos(lat * Math.PI / 180) /
           (Math.pow(2, ZOOM) * TILE_SIZE);
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function latLonToMosaicPixel(lat, lon, xtMin, ytMin) {
    const t = latLonToTileFractional(lat, lon);
    return {
        col: (t.x - xtMin) * TILE_SIZE - 0.5,
        row: (t.y - ytMin) * TILE_SIZE - 0.5
    };
}

function bilinear(elev, col, row, pw, ph) {
    col = Math.max(0, Math.min(pw - 1.001, col));
    row = Math.max(0, Math.min(ph - 1.001, row));
    const c0 = Math.floor(col), r0 = Math.floor(row);
    const fc = col - c0, fr = row - r0;
    const c1 = c0 + 1, r1 = r0 + 1;
    return elev[r0 * pw + c0] * (1 - fc) * (1 - fr) +
           elev[r0 * pw + c1] *      fc  * (1 - fr) +
           elev[r1 * pw + c0] * (1 - fc) *      fr  +
           elev[r1 * pw + c1] *      fc  *      fr;
}
