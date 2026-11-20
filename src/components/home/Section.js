import Icon from "../Icon.js";
import { CardsSkeleton } from "../Loader.js";
import { LoadingSwap } from "../motion/index.js";

export default function Section({ id, title, subtitle, icon, actions, loading = false, children }) {
    return (
        <section id={id} aria-busy={loading} className="relative flex min-w-0 flex-col gap-4">
            {(title || actions) && (
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-maintext sm:text-2xl">
                            {icon && <Icon name={icon} className="h-5 w-5 text-subtext" />}
                            <span>{title}</span>
                        </h2>
                        {subtitle && <p className="mt-1 text-[13px] text-subtext">{subtitle}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            )}
            <LoadingSwap loading={loading} fallback={<CardsSkeleton />} contentClassName="flex min-w-0 flex-col gap-4">
                {children}
            </LoadingSwap>
        </section>
    );
}

export function Empty({ children, action }) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-elevated/35 px-5 py-6">
            <p className="text-[13px] leading-relaxed text-subtext">{children}</p>
            {action}
        </div>
    );
}
