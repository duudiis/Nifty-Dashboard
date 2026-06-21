import { useEffect, useRef, useState } from "react";

import { motion } from "./motion/index.js";

// Shows `text` on a single line. If it fits, it sits still. If it overflows the
// container, it gently scrolls side-to-side so the whole title is readable
// (nicer than an ellipsis for track titles). Width is bounded by the parent, so
// give this a constrained container (e.g. max-w-…).
export default function Marquee({ text, className = "" }) {
    const wrap = useRef(null);
    const inner = useRef(null);
    const [dist, setDist] = useState(0);

    useEffect(() => {
        const measure = () => {
            const w = wrap.current;
            const n = inner.current;
            if (!w || !n) return;
            const overflow = n.scrollWidth - w.clientWidth;
            setDist(overflow > 4 ? overflow : 0);
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (wrap.current) ro.observe(wrap.current);
        return () => ro.disconnect();
    }, [text]);

    const duration = Math.max(6, dist / 25);

    return (
        <div ref={wrap} className={`overflow-hidden ${className}`}>
            <motion.span
                ref={inner}
                className="inline-block whitespace-nowrap will-change-transform"
                animate={dist > 0 ? { x: [0, -dist, -dist, 0, 0] } : { x: 0 }}
                transition={
                    dist > 0
                        ? { duration, times: [0, 0.4, 0.5, 0.9, 1], ease: "linear", repeat: Infinity, repeatDelay: 0.6 }
                        : { duration: 0 }
                }
            >
                {text}
            </motion.span>
        </div>
    );
}
