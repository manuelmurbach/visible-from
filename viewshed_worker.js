// viewshed_worker.js
// Receives a pre-decoded elevation mosaic from the main thread.
// Runs a radial-sweep viewshed: marks every mosaic cell as visible or hidden
// from the selected peak.  No canvas / DOM access needed.

importScripts('dem_math.js');

self.onmessage = function (e) {
    const {
        elev: elevBuf, pw: pwIn, ph: phIn,
        xtMin, ytMin, xtMax, ytMax,
        peakLat, peakLon,
        subsample, outSize
    } = e.data;
    const elevIn = new Float32Array(elevBuf);

    const post = (msg, pct) => {
        console.log(`[viewshed] ${msg} (${Math.round(pct)}%)`);
        self.postMessage({ type: 'progress', message: msg, percent: pct });
    };

    try {
        console.log('[viewshed] started', { pwIn, phIn, subsample, outSize });
        post('Computing viewshed…', 0);

        // -------------------------------------------------------------------
        // 1. Optional downsampling
        // -------------------------------------------------------------------
        const { elev, pw, ph } = subsampleMosaic(elevIn, pwIn, phIn, subsample);

        // -------------------------------------------------------------------
        // 2. Peak position & elevation in subsampled coords
        // -------------------------------------------------------------------
        const peakPxRaw = latLonToMosaicPixel(peakLat, peakLon, xtMin, ytMin);
        const cCtr = Math.round(peakPxRaw.col / subsample);
        const rCtr = Math.round(peakPxRaw.row / subsample);

        // A single (bilinear) DEM sample at the exact peak coordinate badly
        // underestimates sharp, narrow summits (e.g. Matterhorn) – it averages
        // in the lower terrain around the point, and the given lat/lon is
        // rarely pixel-perfect on the true high point anyway. Instead, search
        // a small window (~3 px ≈ 80 m at zoom 12) around the peak position
        // and take the highest raw DEM sample found – then still add the
        // +50 m buffer on top as a further margin against false "obstructed"
        // results.
        const SEARCH_RADIUS_PX = 3;
        let peakElevRaw = -Infinity;
        for (let dr = -SEARCH_RADIUS_PX; dr <= SEARCH_RADIUS_PX; dr++) {
            const r = rCtr + dr;
            if (r < 0 || r >= ph) continue;
            for (let dc = -SEARCH_RADIUS_PX; dc <= SEARCH_RADIUS_PX; dc++) {
                const c = cCtr + dc;
                if (c < 0 || c >= pw) continue;
                const h = elev[r * pw + c];
                if (h > peakElevRaw) peakElevRaw = h;
            }
        }
        const peakElev = peakElevRaw + 50;

        // Effective pixel size after downsampling
        const pxM = pixelMetres(peakLat) * subsample;

        // Sweep out to the edge of the mosaic from the centre
        const maxPx = Math.ceil(Math.max(pw, ph) / 2 + 2);

        // -------------------------------------------------------------------
        // 3. Radial sweep
        // -------------------------------------------------------------------
        const N_RAYS = Math.ceil(2 * Math.PI * maxPx) * 2; // 2× for full coverage

        // 0=unvisited, 1=visible, 2=blocked
        const visible = new Uint8Array(pw * ph);
        if (cCtr >= 0 && cCtr < pw && rCtr >= 0 && rCtr < ph)
            visible[rCtr * pw + cCtr] = 1;

        for (let ri = 0; ri < N_RAYS; ri++) {
            const angle = (2 * Math.PI * ri) / N_RAYS;
            const sinA  = Math.sin(angle); // east  = +col
            const cosA  = Math.cos(angle); // north = −row

            let maxSlope = -Infinity;

            for (let step = 1; step <= maxPx; step++) {
                const col = Math.round(cCtr + sinA * step);
                const row = Math.round(rCtr - cosA * step);

                if (col < 0 || col >= pw || row < 0 || row >= ph) break;

                const distM = step * pxM;
                const curv  = (distM * distM) / (2 * R_EFF);
                const h     = elev[row * pw + col];

                // Terrain surface slope: determines blocking horizon
                const slopeTerrain = (h - curv - peakElev) / distM;
                // Person slope (eye height): determines visibility of a standing observer
                const slopePerson  = (h + EYE_HEIGHT - curv - peakElev) / distM;

                const idx = row * pw + col;
                if (visible[idx] === 0)
                    visible[idx] = slopePerson >= maxSlope ? 1 : 2;

                if (slopeTerrain > maxSlope) maxSlope = slopeTerrain;
            }

            if ((ri & 0x3FF) === 0)
                post('Computing viewshed…', (ri / N_RAYS) * 90);
        }

        post('Rendering overlay…', 92);

        // -------------------------------------------------------------------
        // 4. Render RGBA overlay (capped at outSize px per side)
        // -------------------------------------------------------------------
        const scale = Math.min(1, outSize / Math.max(pw, ph));
        const outW  = Math.max(1, Math.round(pw * scale));
        const outH  = Math.max(1, Math.round(ph * scale));
        const buf   = new Uint8ClampedArray(outW * outH * 4); // transparent

        // Helper: is this mosaic cell visible?
        const isVis = (sr, sc) =>
            sr >= 0 && sr < ph && sc >= 0 && sc < pw && visible[sr * pw + sc] === 1;

        for (let or = 0; or < outH; or++) {
            const sr = Math.round(or / scale);
            for (let oc = 0; oc < outW; oc++) {
                const sc = Math.round(oc / scale);
                if (sr >= ph || sc >= pw) continue;
                if (!isVis(sr, sc)) continue;

                // Edge: any 4-connected neighbour in source grid is not visible
                const onEdge = !isVis(sr - 1, sc) || !isVis(sr + 1, sc) ||
                               !isVis(sr, sc - 1) || !isVis(sr, sc + 1);

                const i4 = (or * outW + oc) * 4;
                if (onEdge) {
                    buf[i4]     = 0;
                    buf[i4 + 1] = 75;
                    buf[i4 + 2] = 22;
                    buf[i4 + 3] = 255; // fully opaque dark-green border
                } else {
                    buf[i4]     = 12;
                    buf[i4 + 1] = 130;
                    buf[i4 + 2] = 45;
                    buf[i4 + 3] = 220; // darker, more opaque fill
                }
            }
        }

        // Geographic bounds of the mosaic (tile corners, not the subsampled grid)
        const nwCorner = tileCornerLatLon(xtMin, ytMin);
        const seCorner = tileCornerLatLon(xtMax + 1, ytMax + 1);
        const bounds   = { north: nwCorner.lat, south: seCorner.lat,
                           west:  nwCorner.lon,  east: seCorner.lon };

        self.postMessage(
            { type: 'result', buffer: buf.buffer, width: outW, height: outH, bounds, peakElev },
            [buf.buffer]
        );

    } catch (err) {
        console.error('[viewshed] fatal:', err);
        self.postMessage({ type: 'error', message: err.message + (err.stack ? '\n' + err.stack : '') });
    }
};
