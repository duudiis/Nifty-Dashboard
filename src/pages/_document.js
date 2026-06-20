import { Html, Head, Main, NextScript } from "next/document";

// Apply the saved theme before first paint to avoid a flash of the default.
const themeScript = `
(function () {
    try {
        var s = JSON.parse(localStorage.getItem("nifty:settings") || "{}");
        document.documentElement.dataset.theme = s.theme || "nifty";
    } catch (e) {
        document.documentElement.dataset.theme = "nifty";
    }
})();
`;

export default function Document() {
    return (
        <Html lang="en" data-theme="nifty">
            <Head>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <body>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
