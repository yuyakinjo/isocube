export { CHARACTERS } from '../src/glyphs.js';
export {
  generateLogo,
  getDefaultGlyphs,
  parseGlyphConfig,
  serializeGlyphConfig,
} from '../src/index.js';
export type { Glyph, GlyphConfig } from '../src/index.js';

// Saved glyphs come back through /__glyphs, so a save must not reload the editor.
import.meta.hot.accept();
