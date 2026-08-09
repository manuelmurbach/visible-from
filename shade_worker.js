// shade_worker.js
// Receives a pre-decoded elevation mosaic from the main thread.
// For each pixel in the current map viewport, casts a ray toward the sun
// through the DEM and marks it as shaded if any terrain blocks the sun.
// No canvas / DOM access needed.

importScripts('dem_math.js');

self.onmessage = function (e) {
    const {
        elev: elevBuf, pw, ph, xtMin, ytMin, subsample,
        sunAzimuthDeg, sunAltitudeDeg,
        viewBounds, shadowStepM, shadowOutSize
    } = e.data;
    const elev = new Int16Array(elevBuf);

    const post = (msg, pct) => {
        console.log(`[shadow] ${msg} (${Math.round(pct)}%)`);
        self.postMessage({ type: 'progress', message: msg, percent: pct });
    };

    try {
        console.log('[shadow] started', { pw, ph, sunAzimuthDeg, sunAltitudeDeg });

        if (sunAltitudeDeg <= 0) {
            self.postMessage({ type: 'allDark' });
            return;
        }

        post('Computing shadows…', 0);

        const sunAz  = sunAzimuthDeg  * Math.PI / 180;
        const sunAlt = sunAltitudeDeg * Math.PI / 180;
        const tanAlt = Math.tan(sunAlt);

        const STEP_M       = shadowStepM;
        const MAX_SHADOW_M = Math.min(80000, Math.max(3000, 4000 / tanAlt));
        const MAX_STEPS    = Math.ceil(MAX_SHADOW_M / STEP_M);

        // Build output grid sized to the viewport
        const OUT_MAX = shadowOutSize;
        const vLat    = viewBounds.lat_max - viewBounds.lat_min;
        const vLon    = viewBounds.lon_max - viewBounds.lon_min;
        const aspect  = vLon / vLat /
            Math.cos((viewBounds.lat_min + viewBounds.lat_max) / 2 * Math.PI / 180);

        let outW, outH;
        if (aspect >= 1) {
            outW = OUT_MAX;
            outH = Math.max(1, Math.round(OUT_MAX / aspect));
        } else {
            outH = OUT_MAX;
            outW = Math.max(1, Math.round(OUT_MAX * aspect));
        }

        const centralLat = (viewBounds.lat_min + viewBounds.lat_max) / 2;
        // `subsample` = native DEM pixels per mosaic cell (mosaic may be
        // downsampled by loadMosaic() on the main thread to stay within a
        // fixed memory budget) – scale pixel size to match.
        const pxM = pixelMetres(centralLat) * subsample;

        // Sun direction in DEM pixel space
        const dCol  = Math.sin(sunAz) * STEP_M / pxM;
        const dRow  = -Math.cos(sunAz) * STEP_M / pxM;
        const dElev = STEP_M * tanAlt;

        const shadow = new Uint8ClampedArray(outW * outH * 4);

        for (let or = 0; or < outH; or++) {
            const lat = viewBounds.lat_max - (or + 0.5) / outH * vLat;

            for (let oc = 0; oc < outW; oc++) {
                const lon  = viewBounds.lon_min + (oc + 0.5) / outW * vLon;
                const px   = latLonToMosaicPixel(lat, lon, xtMin, ytMin);
                // latLonToMosaicPixel returns native-resolution coordinates;
                // convert into the (possibly downsampled) mosaic's grid.
                const col0 = px.col / subsample, row0 = px.row / subsample;

                if (col0 < 0 || col0 >= pw || row0 < 0 || row0 >= ph) continue;

                const h0 = bilinear(elev, col0, row0, pw, ph);

                let inShadow = false;
                for (let step = 1; step <= MAX_STEPS; step++) {
                    const qCol = col0 + step * dCol;
                    const qRow = row0 + step * dRow;

                    if (qCol < 0 || qCol >= pw || qRow < 0 || qRow >= ph) break;

                    const sightlineH = h0 + step * dElev;
                    if (bilinear(elev, qCol, qRow, pw, ph) > sightlineH) {
                        inShadow = true;
                        break;
                    }
                }

                if (inShadow) {
                    const i4 = (or * outW + oc) * 4;
                    shadow[i4]     = 20;
                    shadow[i4 + 1] = 20;
                    shadow[i4 + 2] = 60;
                    shadow[i4 + 3] = 140;
                }
            }

            if ((or & 0xF) === 0)
                post('Computing shadows…', (or / outH) * 95);
        }

        const bounds = {
            north: viewBounds.lat_max, south: viewBounds.lat_min,
            west:  viewBounds.lon_min, east:  viewBounds.lon_max
        };

        self.postMessage(
            { type: 'result', buffer: shadow.buffer, width: outW, height: outH, bounds },
            [shadow.buffer]
        );

    } catch (err) {
        console.error('[shadow] fatal:', err);
        self.postMessage({ type: 'error', message: err.message + (err.stack ? '\n' + err.stack : '') });
    }
};
