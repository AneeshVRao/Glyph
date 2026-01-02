import { Helmet } from "react-helmet-async";
import Terminal from "@/components/Terminal";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Glyph - Terminal Notes</title>
        <meta
          name="description"
          content="Glyph: A terminal-style, local-first note-taking app that works offline. Store notes in your browser with IndexedDB. No login required."
        />
        <meta
          name="keywords"
          content="notes, terminal, offline, local-first, developer tools, keyboard-driven, glyph"
        />
      </Helmet>
      <Terminal />
    </>
  );
};

export default Index;
