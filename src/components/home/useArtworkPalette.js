import { useEffect, useState } from "react";

/**
 * Pulls a small, vivid palette out of a piece of cover art.
 *
 * Every artwork host the catalogue uses — Spotify, YouTube, Deezer, SoundCloud,
 * Tidal — serves `Access-Control-Allow-Origin: *`, so the pixels really can be
 * read; the app's older assumption that remote covers would taint a canvas was
 * wrong. Reading them properly is what separates painting WITH a record's
 * colours from just showing a blurry picture of the record.
 *
 * The image is sampled at 24x24 (576 pixels is plenty for a palette), pixels
 * too dark, too pale or too grey to carry colour are dropped, and what remains
 * is bucketed by hue so the result is a few genuinely different colours rather
 * than five shades of the same one.
 */

const SIZE = 24;
const BUCKETS = 24;   // 15° of hue each
const WANTED = 5;

// How far the palette fans out around the record's dominant hue. Analogous on
// purpose: the lobes are screened together, and screening a blue, a red and a
// yellow does not make an aurora, it makes grey. One neighbouring family reads
// as light; five competing hues read as mud.
const SPREAD = [0, 26, -24, 50, -46];

// A second hue earns one lobe only if it is nearly as strong as the dominant
// one AND genuinely far from it — the orange in a mostly-green sleeve.
const CONTRAST_WEIGHT = 0.55;
const CONTRAST_GAP = 40; // degrees

const cache = new Map();

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
}

function hslToCss(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return `rgb(${f(0)} ${f(8)} ${f(4)})`;
}

const hueGap = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 360 - d);
};

function extract(img) {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);

    let data;
    try {
        data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    } catch {
        return null; // a host that turned out not to allow reads after all
    }

    // Two passes: colourful pixels first, and if a cover is nearly monochrome
    // (plenty are) count anything that is not black or white, so a muted sleeve
    // still yields something to paint with.
    for (const minSat of [0.18, 0.05]) {
        const bins = Array.from({ length: BUCKETS }, () => ({ weight: 0, h: 0, s: 0, l: 0 }));

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
            if (l < 0.1 || l > 0.94 || s < minSat) continue;

            // Saturation-weighted: one vivid pixel says more about a cover's
            // character than a dozen muddy ones.
            const w = s * s + 0.15;
            const bin = bins[Math.floor(h / (360 / BUCKETS)) % BUCKETS];
            bin.weight += w;
            bin.h += h * w;
            bin.s += s * w;
            bin.l += l * w;
        }

        const ranked = bins
            .filter((b) => b.weight > 0)
            .map((b) => ({ h: b.h / b.weight, s: b.s / b.weight, l: b.l / b.weight, weight: b.weight }))
            .sort((a, b) => b.weight - a.weight);

        if (!ranked.length) continue;

        const base = ranked[0];
        const contrast = ranked.find(
            (c) => c.weight > base.weight * CONTRAST_WEIGHT && hueGap(c.h, base.h) > CONTRAST_GAP
        );

        return SPREAD.slice(0, WANTED).map((offset, i) => {
            const src = contrast && i === 3 ? contrast : base;
            // Pushed into the band where light actually reads as light: raw
            // album colours are usually too dark or too washed out to glow.
            const s2 = Math.min(0.95, Math.max(0.62, src.s * 1.4));
            const l2 = Math.min(0.7, Math.max(0.48, src.l * 1.2 + (i % 2 ? 0.05 : -0.03)));
            return hslToCss((src.h + offset + 360) % 360, s2, l2);
        });
    }

    return null;
}

export default function useArtworkPalette(artwork) {
    const [palette, setPalette] = useState(() => (artwork ? cache.get(artwork) || null : null));

    useEffect(() => {
        if (!artwork) { setPalette(null); return; }

        const hit = cache.get(artwork);
        if (hit) { setPalette(hit); return; }

        let live = true;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => {
            if (!live) return;
            let colors = null;
            try { colors = extract(img); } catch { colors = null; }
            if (colors) cache.set(artwork, colors);
            if (live) setPalette(colors);
        };
        img.onerror = () => { if (live) setPalette(null); };
        img.src = artwork;

        return () => { live = false; };
    }, [artwork]);

    return palette;
}
