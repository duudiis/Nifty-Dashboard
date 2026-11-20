import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { motion, EASE } from "./motion/index.js";

const images = new Map();
const MAX_IMAGES = 96;

function prepareArtwork(source) {
    if (!source) return Promise.resolve(null);
    if (source === "accent") return Promise.resolve(source);
    const hit = images.get(source);
    if (hit) return hit.promise;

    const entry = { ready: false, promise: null };
    entry.promise = new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        image.decoding = "async";
        const finish = (success) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            entry.ready = success;
            if (!success && images.get(source) === entry) images.delete(source);
            resolve(success ? source : null);
        };
        const timeout = setTimeout(() => finish(false), 12000);
        image.onload = async () => {
            // onload alone does not guarantee pixels are available for the
            // first animation frame, especially for large remote artwork.
            try { await image.decode(); } catch { /* SVGs may already be decoded. */ }
            finish(image.naturalWidth > 0);
        };
        image.onerror = () => finish(false);
        image.src = source;
    });
    images.set(source, entry);
    if (images.size > MAX_IMAGES) images.delete(images.keys().next().value);
    return entry.promise;
}

const isPrepared = (source) => source === "accent" || images.get(source)?.ready;

// Newly colored copies join the existing CSS motion at the same point in its
// cycle. A palette change should change color, not restart every moving blob.
export function useBackdropPhase() {
    const started = useRef(null);
    useEffect(() => { if (started.current == null) started.current = Date.now(); }, []);
    return { animationDelay: started.current == null ? "0s" : `${-(Date.now() - started.current) / 1000}s` };
}

// Never replace visible pixels with a URL whose pixels are still unavailable.
// Empty transient player/page snapshots retain the last cover by default.
export function useDecodedArtwork(source, { fallback = null, retainOnEmpty = true } = {}) {
    const [shown, setShown] = useState(() => isPrepared(source) ? source : isPrepared(fallback) ? fallback : null);
    useEffect(() => {
        let live = true;
        const requested = source || (retainOnEmpty && shown ? null : fallback);
        if (!requested) {
            if (!retainOnEmpty) setShown(null);
            return;
        }
        if (isPrepared(requested)) {
            setShown(requested);
            return;
        }
        prepareArtwork(requested).then(async (ready) => {
            const next = ready || (!shown && fallback ? await prepareArtwork(fallback) : null);
            if (live && next) setShown(next);
        });
        return () => { live = false; };
    }, [source, fallback, retainOnEmpty]);
    return shown;
}

// Each scene paints its own opaque surface. The old scene stays at full
// opacity while the decoded replacement dissolves over it. Fading both scenes
// out/in would expose 25% of the bare surface at the midpoint, producing the
// dark pulse that is especially visible on album tints and the home aurora.
function BackdropScene({ frame, duration, onComplete, onError }) {
    // This value belongs to the scene for its entire lifetime. In particular,
    // removing older siblings must not change this node's initial/animate
    // props and reset a completed browser opacity animation back to zero.
    const opacity = useMotionValue(frame.enter ? 0 : 1);
    const element = useRef(null);
    const complete = useRef(onComplete);
    complete.current = onComplete;
    const failed = useRef(onError);
    failed.current = onError;
    useEffect(() => {
        let live = true;
        let animation;
        (async () => {
            try {
                // Decoding a separate preload is not enough when a host
                // revalidates artwork. Wait for the actual painted image
                // elements, leaving the old opaque scene beneath them.
                await Promise.all([...element.current.querySelectorAll("img")].map(async (image) => {
                    try { await image.decode(); } catch (error) {
                        if (!image.complete || !image.naturalWidth) throw error;
                    }
                }));
                if (!live) return;
                animation = animate(opacity, 1, {
                    duration,
                    ease: EASE,
                    onComplete: () => complete.current()
                });
            } catch {
                if (live) failed.current();
            }
        })();
        return () => { live = false; animation?.stop(); };
    }, [opacity, duration]);

    return (
        <motion.div
            ref={element}
            data-backdrop-scene
            className="absolute inset-0 isolate bg-surface"
            initial={false}
            style={{ opacity }}
        >
            {frame.children}
        </motion.div>
    );
}

export function BackdropCrossfade({ identity, children, className = "", duration = 0.45 }) {
    const reduceMotion = useReducedMotion();
    const sequence = useRef(0);
    const [frames, setFrames] = useState(() => [{ id: 0, identity, children, enter: false }]);
    const latest = useRef(identity);
    latest.current = identity;
    const content = useRef(children);
    content.current = children;

    useEffect(() => {
        setFrames((previous) => {
            if (previous[previous.length - 1]?.identity === identity) return previous;
            const frame = { id: ++sequence.current, identity, children: content.current, enter: true };
            // Rapid changes keep their already-visible layers until the
            // newest one finishes; no half-painted frame becomes the base.
            return [...previous, frame];
        });
    }, [identity, reduceMotion]);

    return (
        <div aria-hidden className={`absolute inset-0 isolate ${className}`} data-backdrop-crossfade>
            {frames.map((frame) => (
                <BackdropScene
                    key={frame.id}
                    frame={frame}
                    duration={reduceMotion ? 0 : duration}
                    onError={() => {
                        setFrames((previous) => previous.length > 1
                            ? previous.filter((item) => item.id !== frame.id) : previous);
                    }}
                    onComplete={() => {
                        if (frame.identity !== latest.current) return;
                        setFrames((previous) => previous.length > 1 && previous[previous.length - 1]?.id === frame.id
                            ? [previous[previous.length - 1]] : previous);
                    }}
                />
            ))}
        </div>
    );
}
