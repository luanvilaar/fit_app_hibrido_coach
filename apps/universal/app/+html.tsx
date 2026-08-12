import { type PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

const directionContract = `<!--
THESIS: Performance in the Dark replaces the old light/Sentry worlds. The app is a premium
training environment where layered graphite recedes behind real athlete, session and coach work.
OWN-WORLD: #050507 through #252530 create depth; Barlow Condensed owns editorial hierarchy;
Inter carries every operational task. FitBlock purple is reserved for action, selection, focus,
progress and controlled ambient glow.
STORY: Visitors discover a credible training ecosystem; athletes execute their next action; coaches
prescribe and coordinate without losing clarity.
FIRST VIEWPORT: A mobile-first dark field keeps the session, media and primary action readable in
the first view. Larger screens expand into a media-led editorial composition, never a light dashboard.
FORM: FitBlock Dark Performance, source FITBLOCK-DARK-PERFORMANCE-SPEC.md; concept seed ce6f55ce.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`;

/** Web document shell. Native platforms render only Expo Router routes. */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#08080B" />
        <ScrollViewStyleReset />
      </head>
      <body>
        <template id="fitblock-direction-contract" dangerouslySetInnerHTML={{ __html: directionContract }} />
        {children}
      </body>
    </html>
  );
}
