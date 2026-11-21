import { useNifty } from "../../context/NiftyContext.js";
import { mediaKeysSupported } from "../player/MediaKeys.js";
import { Note, PageHeading, Row, Rows, Section, Switch } from "./primitives.js";

export default function PlaybackPage() {
    const { settings, updateSettings } = useNifty();
    const supported = mediaKeysSupported();

    return (
        <>
            <PageHeading
                eyebrow="Hands on the keys"
                title="Playback"
                description="How this device controls what the bot is playing."
            />

            <Section title="Media keys">
                <Rows>
                    <Row
                        title="Media keys and system controls"
                        description="Show what's playing in your system's media controls, and let the play, pause, next and previous keys — and headset buttons — control Nifty."
                    >
                        <Switch
                            label="Media keys and system controls"
                            checked={supported && settings.mediaKeys !== false}
                            onChange={(mediaKeys) => supported && updateSettings({ mediaKeys })}
                        />
                    </Row>
                </Rows>
            </Section>

            <Note>
                {supported
                    ? "The music plays in Discord, so to receive those keys this tab plays a silent track while the bot is playing. On a phone that can pause other audio apps — turn this off if it gets in the way. It starts after your first click or key press on the page."
                    : "This browser doesn't offer system media controls."}
            </Note>
        </>
    );
}
