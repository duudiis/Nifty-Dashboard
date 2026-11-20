import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { Badge, Button, Card, HAIRLINE, IconTile, PageHeading, Section } from "./primitives.js";

// Accent-tinted banner behind the avatar; follows whichever theme is active.
const COVER = {
    background: [
        "radial-gradient(ellipse at 90% 10%, rgb(var(--c-accent) / 0.38), transparent 60%)",
        "linear-gradient(130deg, rgb(var(--c-accent) / 0.26), rgb(var(--c-accent) / 0.1) 45%, rgb(var(--c-accent) / 0.2))"
    ].join(", ")
};

export default function AccountPage() {
    const { user, library, logout } = useNifty();

    const stats = [
        { label: "Liked songs", value: library.likedUrls.length },
        { label: "In library", value: library.items.length },
        { label: "Playlists", value: library.playlists.length }
    ];

    return (
        <>
            <PageHeading
                eyebrow="Good to have you here"
                title="Account"
                description="You sign in with Discord — the bot knows you by the same account."
            />

            <Card className="mb-7 overflow-hidden">
                <div className="h-[76px]" style={COVER} />
                <div className="relative px-5 pb-[18px] pt-11">
                    <img
                        src={user?.avatar_url}
                        alt=""
                        className="absolute -top-[33px] left-[17px] h-[65px] w-[65px] rounded-full border-[5px] border-canvas bg-elevated object-cover"
                    />
                    <div className="absolute right-4 top-3.5">
                        <Badge icon="discord">Connected</Badge>
                    </div>
                    <h3 className="truncate text-lg font-semibold tracking-tight text-maintext">{user?.username}</h3>
                    <p className="mt-0.5 text-xs text-subtext">Discord ID {user?.id}</p>
                </div>
            </Card>

            <Section title="Your library">
                <div className="grid grid-cols-3 gap-3">
                    {stats.map((stat) => (
                        <div key={stat.label} className={`rounded-lg border bg-canvas/60 px-4 py-3 ${HAIRLINE}`}>
                            <span className="block text-xl font-semibold tabular-nums text-maintext">{stat.value}</span>
                            <span className="mt-0.5 block text-[11px] text-subtext">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Connected account">
                <div className="flex items-center gap-3">
                    <IconTile name="discord" />
                    <div className="min-w-0 flex-1">
                        <strong className="block text-[13px] font-medium text-maintext">Discord</strong>
                        <span className="mt-1 block text-xs text-subtext">Your name and avatar come from Discord.</span>
                    </div>
                    <Icon name="check" className="h-4 w-4 text-emerald-400" />
                </div>
            </Section>

            <div className="flex items-center justify-between gap-5 pt-0.5">
                <div className="min-w-0">
                    <strong className="block text-[13px] font-medium text-maintext">Log out</strong>
                    <p className="mt-1 text-xs text-subtext">Ends this browser session. Your library stays.</p>
                </div>
                <Button tone="danger" icon="logout" onClick={logout}>Log out</Button>
            </div>
        </>
    );
}
