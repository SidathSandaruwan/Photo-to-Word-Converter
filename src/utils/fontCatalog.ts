import type { FontCategory } from '../types/typography.ts';

export interface WordFontOption {
  name: string;
  googleFont?: string;
  category: FontCategory;
}

export const WORD_FONT_CATALOG: WordFontOption[] = [
  // Serif
  { name: 'Garamond', googleFont: 'EB Garamond', category: 'Serif' },
  { name: 'EB Garamond', googleFont: 'EB Garamond', category: 'Serif' },
  { name: 'Georgia', googleFont: 'Lora', category: 'Serif' },
  { name: 'Times New Roman', googleFont: 'Tinos', category: 'Serif' },
  { name: 'Cambria', googleFont: 'Caladea', category: 'Serif' },
  { name: 'Baskerville', googleFont: 'Libre Baskerville', category: 'Serif' },
  { name: 'Libre Baskerville', googleFont: 'Libre Baskerville', category: 'Serif' },
  { name: 'Palatino Linotype', googleFont: 'Crimson Pro', category: 'Serif' },
  { name: 'Book Antiqua', googleFont: 'Crimson Pro', category: 'Serif' },
  { name: 'Playfair Display', googleFont: 'Playfair Display', category: 'Serif' },
  { name: 'Merriweather', googleFont: 'Merriweather', category: 'Serif' },
  { name: 'Lora', googleFont: 'Lora', category: 'Serif' },
  { name: 'Source Serif 4', googleFont: 'Source Serif 4', category: 'Serif' },
  { name: 'Cormorant Garamond', googleFont: 'Cormorant Garamond', category: 'Serif' },

  // Sans-Serif
  { name: 'Calibri', googleFont: 'Carlito', category: 'Sans-Serif' },
  { name: 'Arial', googleFont: 'Arimo', category: 'Sans-Serif' },
  { name: 'Helvetica', googleFont: 'Arimo', category: 'Sans-Serif' },
  { name: 'Helvetica Neue', googleFont: 'Plus Jakarta Sans', category: 'Sans-Serif' },
  { name: 'Segoe UI', googleFont: 'Open Sans', category: 'Sans-Serif' },
  { name: 'Verdana', googleFont: 'Open Sans', category: 'Sans-Serif' },
  { name: 'Trebuchet MS', googleFont: 'Fira Sans', category: 'Sans-Serif' },
  { name: 'Century Gothic', googleFont: 'Jost', category: 'Sans-Serif' },
  { name: 'Futura', googleFont: 'Jost', category: 'Sans-Serif' },
  { name: 'Franklin Gothic Medium', googleFont: 'Libre Franklin', category: 'Sans-Serif' },
  { name: 'Tahoma', googleFont: 'DM Sans', category: 'Sans-Serif' },
  { name: 'Montserrat', googleFont: 'Montserrat', category: 'Sans-Serif' },
  { name: 'Open Sans', googleFont: 'Open Sans', category: 'Sans-Serif' },
  { name: 'Lato', googleFont: 'Lato', category: 'Sans-Serif' },
  { name: 'Work Sans', googleFont: 'Work Sans', category: 'Sans-Serif' },
  { name: 'Oswald', googleFont: 'Oswald', category: 'Display' },

  // Monospace
  { name: 'Courier New', googleFont: 'Courier Prime', category: 'Monospace' },
  { name: 'Courier Prime', googleFont: 'Courier Prime', category: 'Monospace' },
  { name: 'Consolas', googleFont: 'IBM Plex Mono', category: 'Monospace' },
  { name: 'Lucida Console', googleFont: 'JetBrains Mono', category: 'Monospace' },
  { name: 'IBM Plex Mono', googleFont: 'IBM Plex Mono', category: 'Monospace' },

  // Display & Script
  { name: 'Impact', googleFont: 'Anton', category: 'Display' },
  { name: 'Brush Script MT', googleFont: 'Dancing Script', category: 'Script' },
  { name: 'Dancing Script', googleFont: 'Dancing Script', category: 'Script' },
];

const SAFE_GOOGLE_FONTS = new Set([
  'EB Garamond',
  'Lora',
  'Tinos',
  'Caladea',
  'Libre Baskerville',
  'Crimson Pro',
  'Playfair Display',
  'Merriweather',
  'Source Serif 4',
  'Cormorant Garamond',
  'Carlito',
  'Arimo',
  'Plus Jakarta Sans',
  'Open Sans',
  'Fira Sans',
  'Jost',
  'Libre Franklin',
  'DM Sans',
  'Montserrat',
  'Lato',
  'Work Sans',
  'Oswald',
  'Roboto',
  'Inter',
  'Courier Prime',
  'IBM Plex Mono',
  'JetBrains Mono',
  'Anton',
  'Dancing Script',
  'PT Serif',
  'PT Sans',
  'Nunito',
  'Raleway',
  'Bitter',
  'Spectral',
  'Bodoni Moda',
  'Cinzel',
  'Abril Fatface',
  'Space Mono',
  'Source Code Pro',
  'Great Vibes',
  'Pacifico',
]);

const loadedGoogleFonts = new Set<string>([
  'Plus Jakarta Sans',
  'DM Sans',
  'JetBrains Mono',
]);

export function resolveGoogleFontForName(fontName: string): string | undefined {
  const trimmed = fontName.trim();
  if (!trimmed) return undefined;
  if (SAFE_GOOGLE_FONTS.has(trimmed)) return trimmed;

  const catalogMatch = WORD_FONT_CATALOG.find(
    (entry) => entry.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (catalogMatch?.googleFont) return catalogMatch.googleFont;

  return undefined;
}

export function loadGoogleFonts(fontNames: string[]): void {
  if (typeof document === 'undefined') return;

  const toLoad: string[] = [];
  for (const raw of fontNames) {
    const resolved = resolveGoogleFontForName(raw);
    if (resolved && !loadedGoogleFonts.has(resolved)) {
      loadedGoogleFonts.add(resolved);
      toLoad.push(resolved);
    }
  }

  if (toLoad.length === 0) return;

  const families = toLoad
    .map(
      (name) =>
        `family=${encodeURIComponent(name)}:ital,wght@0,400;0,600;0,700;1,400;1,600`
    )
    .join('&');

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

export function getCssFontStack(
  primaryName: string,
  googleFont?: string,
  category?: FontCategory
): string {
  const parts: string[] = [];
  if (primaryName) parts.push(`"${primaryName.replace(/"/g, '')}"`);
  const resolvedGoogle = googleFont || resolveGoogleFontForName(primaryName);
  if (resolvedGoogle && resolvedGoogle.toLowerCase() !== primaryName.toLowerCase()) {
    parts.push(`"${resolvedGoogle.replace(/"/g, '')}"`);
  }

  switch (category) {
    case 'Monospace':
      parts.push('"Courier Prime"', '"Courier New"', 'monospace');
      break;
    case 'Sans-Serif':
      parts.push('"DM Sans"', 'Arial', 'sans-serif');
      break;
    case 'Script':
      parts.push('"Dancing Script"', 'cursive');
      break;
    case 'Display':
      parts.push('"Plus Jakarta Sans"', 'Impact', 'sans-serif');
      break;
    case 'Serif':
    default:
      parts.push('Georgia', '"Times New Roman"', 'serif');
      break;
  }

  return parts.join(', ');
}

export async function imageUrlToDataUrl(
  url: string
): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not load sample specimen image.');
  }
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({ dataUrl: reader.result, mimeType });
      } else {
        reject(new Error('Failed to decode specimen image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read specimen image.'));
    reader.readAsDataURL(blob);
  });
}

export function createMultiFontSpecimenDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Studio desk background
  ctx.fillStyle = '#D6D9DF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FCFBF8';
  ctx.fillRect(100, 90, 1000, 1420);
  ctx.restore();

  // Subtle top rule
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(180, 185, 840, 2);

  // Sans-serif kicker
  ctx.fillStyle = '#475569';
  ctx.font = '600 22px Arial, Helvetica, sans-serif';
  ctx.fillText('NORTHGATE EDITORIAL PRESS  ·  SPECIFICATION SHEET', 180, 232);

  // Classic Serif Display Headline
  ctx.fillStyle = '#111827';
  ctx.font = '700 60px Georgia, "Times New Roman", serif';
  ctx.fillText('Quarterly Typography', 180, 326);
  ctx.fillText('Review & Standards', 180, 396);

  // Italic Serif Deck
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 30px Georgia, "Times New Roman", serif';
  ctx.fillText(
    'Prepared for print production and digital archive teams',
    180,
    458
  );

  // Section 1 Heading (Bold Sans-Serif)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 26px Arial, Helvetica, sans-serif';
  ctx.fillText('1. Primary Book & Report Typography', 180, 550);

  // Body Paragraph 1 (Georgia Serif)
  ctx.fillStyle = '#1F2937';
  ctx.font = '25px Georgia, "Times New Roman", serif';
  const para1 = [
    'Long-form technical essays and annual monographs should be',
    'typeset in a transitional serif typeface with balanced stroke',
    'contrast. Consistent paragraph spacing and generous margins',
    'ensure comfortable legibility across both printed editions and',
    'editable Word documents.',
  ];
  para1.forEach((line, i) => {
    ctx.fillText(line, 180, 602 + i * 40);
  });

  // Section 2 Heading (Bold Sans-Serif)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 26px Arial, Helvetica, sans-serif';
  ctx.fillText('2. Technical Notes & Reference Codes', 180, 862);

  // Body Paragraph 2 (Clean Sans-Serif)
  ctx.fillStyle = '#1F2937';
  ctx.font = '24px Arial, Helvetica, sans-serif';
  const para2 = [
    'All structural headings, figure labels, and data summaries',
    'use a crisp neo-grotesque sans-serif face to create immediate',
    'visual separation from narrative prose.',
  ];
  para2.forEach((line, i) => {
    ctx.fillText(line, 180, 912 + i * 38);
  });

  // Monospace Technical Block
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(180, 1068, 840, 170);
  ctx.fillStyle = '#1E293B';
  ctx.font = '23px "Courier New", Courier, monospace';
  ctx.fillText('DOCUMENT_REF : NGP-2026-0418', 216, 1126);
  ctx.fillText('TRIM_FORMAT  : US LETTER (8.5 x 11 IN)', 216, 1166);
  ctx.fillText('INK_PROFILE  : ARCHIVAL GRAPHITE #111827', 216, 1206);

  // Footer caption
  ctx.fillStyle = '#64748B';
  ctx.font = '20px Arial, Helvetica, sans-serif';
  ctx.fillText('Approved for internal studio distribution  —  Page 01', 180, 1410);

  return canvas.toDataURL('image/jpeg', 0.92);
}
