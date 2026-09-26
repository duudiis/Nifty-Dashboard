import Icon from "../Icon.js";
import { motion, entrance } from "../motion/index.js";

// The frame every home section sits in: a heading, an optional action on the
// right, and its body — which stays empty while loading and fades in once the
// data lands.
//
// `minHeight` is not decoration. An empty body has no height; without a
// reserved one the page would jolt downward as each section landed. Every
// caller passes the height its real content will occupy, so nothing moves when
// the data arrives.
export default function Section({
    id,
    title,
    subtitle,
    icon,
    actions,
    loading = false,
    minHeight = 200,
    children
}) {
    return (
        <section id={id} className="relative flex flex-col gap-3" style={{ minHeight: loading ? minHeight : undefined }}>
            {(title || actions) && (
                <div className="flex items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-maintext">
                            {icon && <Icon name={icon} className="h-5 w-5 text-subtext" />}
                            <span className="truncate">{title}</span>
                        </h3>
                        {subtitle && <p className="truncate text-xs text-subtext">{subtitle}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            )}

            {!loading && (
                <motion.div {...entrance(0)} className="flex flex-col gap-3">
                    {children}
                </motion.div>
            )}
        </section>
    );
}

// The empty state every section falls back to — one quiet line, optionally with
// something to do about it.
export function Empty({ children, action }) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border px-5 py-6">
            <p className="text-[13px] leading-relaxed text-subtext">{children}</p>
            {action}
        </div>
    );
}
