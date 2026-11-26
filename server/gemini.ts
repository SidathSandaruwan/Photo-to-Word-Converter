import { GoogleGenAI, Type } from '@google/genai';
import type {
  AnalysisResult,
  DetectedFont,
  FontCategory,
  LayoutBox,
  TextAlignment,
  TextBlock,
  TextRole,
  TextSpan,
  VisualElement,
} from '../src/types/typography.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_CATEGORIES = new Set<FontCategory>([
  'Serif',
  'Sans-Serif',
  'Monospace',
  'Display',
  'Script',
]);

const VALID_ROLES = new Set<TextRole>([
  'title',
  'heading1',
  'heading2',
  'paragraph',
  'quote',
  'list_item',
  'caption',
]);

const VALID_ALIGNMENTS = new Set<TextAlignment>([
  'left',
  'center',
  'right',
  'justify',
]);

function normalizeHex(raw: unknown, fallback = '#1A1A1A'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  return fallback;
}

function normalizeOptionalHex(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') {
    return undefined;
  }
  const cleaned = trimmed.replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  return undefined;
}

function slugifyFontId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `font-${slug}` : `font-${index + 1}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeBox2d(
  raw: unknown
): [number, number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const nums = raw.map((n) => clamp(Math.round(Number(n)), 0, 1000));
  const [ymin, xmin, ymax, xmax] = nums;
  if (ymax <= ymin || xmax <= xmin) return undefined;
  return [ymin, xmin, ymax, xmax];
}

function boxToPageLayout(
  box: [number, number, number, number],
  pageBounds: [number, number, number, number]
): LayoutBox {
  const [pYmin, pXmin, pYmax, pXmax] = pageBounds;
  const pageW = Math.max(10, pXmax - pXmin);
  const pageH = Math.max(10, pYmax - pYmin);

  const [ymin, xmin, ymax, xmax] = box;
  const xPct = clamp(((xmin - pXmin) / pageW) * 100, 0, 98);
  const yPct = clamp(((ymin - pYmin) / pageH) * 100, 0, 98);
  const widthPct = clamp(((xmax - xmin) / pageW) * 100, 1, 100 - xPct);
  const heightPct = clamp(((ymax - ymin) / pageH) * 100, 0.25, 100 - yPct);

  return {
    xPct: round2(xPct),
    yPct: round2(yPct),
    widthPct: round2(widthPct),
    heightPct: round2(heightPct),
  };
}

function calibrateFontSizePt(params: {
  rawPt: number;
  layoutHeightPct: number;
  lineCount: number;
  lineHeight: number;
  pageHeightPt: number;
}): number {
  const { rawPt, layoutHeightPct, lineCount, lineHeight, pageHeightPt } = params;
  const safeRaw = clamp(rawPt || 11, 6, 96);

  if (layoutHeightPct <= 0 || lineCount <= 0) {
    return Math.round(safeRaw * 2) / 2;
  }

  const boxHeightPt = (layoutHeightPct / 100) * pageHeightPt;
  // Estimate visual font size from bounding box height and line count:
  // Single-line tight bounding boxes span roughly 0.85–1.15x em-size;
  // Multi-line boxes span roughly (1 + (lineCount - 1) * lineHeight) * fontSizePt.
  const lineMultiplier =
    lineCount === 1 ? 1.05 : 1.0 + (lineCount - 1) * clamp(lineHeight, 1.05, 1.8);
  const geometricPt = boxHeightPt / lineMultiplier;

  // Keep Gemini's typographic judgment unless it deviates wildly from the true physical geometry
  const minBound = clamp(geometricPt * 0.72, 6, 96);
  const maxBound = clamp(geometricPt * 1.28, 7, 96);
  const calibrated = clamp(safeRaw, minBound, maxBound);

  return Math.round(calibrated * 2) / 2;
}

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    documentTitle: {
      type: Type.STRING,
      description: 'Short human-readable title inferred from the photo.',
    },
    suggestedFilename: {
      type: Type.STRING,
      description:
        'Clean kebab-case filename without extension (e.g. architecture-of-quiet-spaces).',
    },
    language: {
      type: Type.STRING,
      description: 'Primary language of the typed text (e.g. English).',
    },
    pageOrientation: {
      type: Type.STRING,
      description: 'Either "portrait" or "landscape".',
    },
    pageBounds: {
      type: Type.ARRAY,
      description:
        'Bounding box [ymin, xmin, ymax, xmax] (0 to 1000) tightly framing the printed page/sheet/poster inside the photograph (excluding surrounding desk, table, or adjacent spine page). Use [0, 0, 1000, 1000] if the photo is already a full-bleed document or screenshot.',
      items: { type: Type.INTEGER },
    },
    pageBackgroundHex: {
      type: Type.STRING,
      description:
        'Exact sampled 6-digit hex background color of the document page/paper itself (e.g. "#FFFFFF", "#F6F5F0", "#1E293B").',
    },
    summary: {
      type: Type.STRING,
      description:
        'One-sentence summary of the page layout, visual elements, and typography.',
    },
    detectedFonts: {
      type: Type.ARRAY,
      description: 'Distinct font families detected in the photo.',
      items: {
        type: Type.OBJECT,
        properties: {
          detectedName: {
            type: Type.STRING,
            description:
              'Best forensic identification of the exact typeface family (e.g. "EB Garamond", "Georgia", "Helvetica Neue", "Times New Roman", "Courier Prime", "Futura", "Baskerville", "Calibri").',
          },
          wordFont: {
            type: Type.STRING,
            description:
              'Closest standard Microsoft Word font equivalent (e.g. "Garamond", "Georgia", "Times New Roman", "Cambria", "Palatino Linotype", "Calibri", "Arial", "Helvetica", "Segoe UI", "Verdana", "Trebuchet MS", "Century Gothic", "Courier New", "Consolas", "Impact").',
          },
          googleFont: {
            type: Type.STRING,
            description:
              'Closest Google Fonts family name for faithful browser preview (e.g. "EB Garamond", "Lora", "Playfair Display", "Merriweather", "Libre Baskerville", "Source Serif 4", "Crimson Pro", "DM Sans", "Plus Jakarta Sans", "Montserrat", "Open Sans", "Lato", "Roboto", "Work Sans", "Oswald", "Courier Prime", "IBM Plex Mono", "JetBrains Mono", "Dancing Script").',
          },
          category: {
            type: Type.STRING,
            description:
              'One of: "Serif", "Sans-Serif", "Monospace", "Display", "Script".',
          },
          confidence: {
            type: Type.INTEGER,
            description: 'Typographic identification confidence from 55 to 99.',
          },
          characteristics: {
            type: Type.STRING,
            description:
              'Concise forensic notes on letterforms (e.g. "Old-style bracketed serifs, moderate stroke contrast, tall ascenders").',
          },
          sampleText: {
            type: Type.STRING,
            description: 'Short exact excerpt (3 to 8 words) set in this font.',
          },
        },
        required: [
          'detectedName',
          'wordFont',
          'googleFont',
          'category',
          'confidence',
          'characteristics',
          'sampleText',
        ],
      },
    },
    visualElements: {
      type: Type.ARRAY,
      description:
        'All non-text visual elements inside pageBounds so the Word document replicates the exact page design: embedded photographs/illustrations/logos ("image"), shaded panels/banners/callouts behind text ("rectangle"), and horizontal/vertical divider rules ("line"). Do NOT include the desk outside pageBounds.',
      items: {
        type: Type.OBJECT,
        properties: {
          kind: {
            type: Type.STRING,
            description: 'One of: "image", "rectangle", "line".',
          },
          label: {
            type: Type.STRING,
            description:
              'Short description (e.g. "Interior daylight photograph", "Top header divider rule", "Shaded reference box").',
          },
          box2d: {
            type: Type.ARRAY,
            description:
              'Tight bounding box [ymin, xmin, ymax, xmax] normalized 0–1000 in full image coordinates.',
            items: { type: Type.INTEGER },
          },
          fillColorHex: {
            type: Type.STRING,
            description:
              '6-digit hex fill color for "rectangle" or line color for "line" (e.g. "#F1F5F9" or "#1E293B"). Omit or "none" for "image".',
          },
          borderColorHex: {
            type: Type.STRING,
            description:
              'Optional 6-digit hex border color if the box has a visible stroke, otherwise "none".',
          },
          borderWidthPt: {
            type: Type.NUMBER,
            description: 'Optional border/line stroke thickness in points (e.g. 1, 1.5, 2).',
          },
        },
        required: ['kind', 'box2d'],
      },
    },
    blocks: {
      type: Type.ARRAY,
      description:
        'Every visible typed text element inside pageBounds in reading order, preserving exact spatial placement, sizing, colors, and formatting.',
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description:
              'Exact transcribed text. For multi-line display titles or fixed-format lines (e.g. code/reference rows), preserve intentional line breaks with "\\n". For normal prose paragraphs, merge soft wraps into clean flowing prose.',
          },
          role: {
            type: Type.STRING,
            description:
              'One of: "title", "heading1", "heading2", "paragraph", "quote", "list_item", "caption".',
          },
          detectedFont: {
            type: Type.STRING,
            description:
              'Must match one of the detectedName values in detectedFonts.',
          },
          fontSizePt: {
            type: Type.NUMBER,
            description:
              'Exact visual point size scaled to a standard 8.5in-wide printed page (e.g. 34 for large display title, 15 for subtitle, 10.5 for book body, 8.5 for caption/footer).',
          },
          lineCount: {
            type: Type.INTEGER,
            description:
              'Exact number of visual text lines this block occupies in the photo (e.g. 1, 2, 7).',
          },
          lineHeight: {
            type: Type.NUMBER,
            description:
              'Line-height multiplier relative to font size (e.g. 1.15 for tight display headline, 1.42 for body text).',
          },
          letterSpacingPt: {
            type: Type.NUMBER,
            description:
              'Extra horizontal tracking in points (0 for normal text, 0.5 to 2.5 for widely tracked uppercase headers).',
          },
          bold: {
            type: Type.BOOLEAN,
            description: 'True if set in bold or semibold weight.',
          },
          italic: {
            type: Type.BOOLEAN,
            description: 'True if set in italic or oblique style.',
          },
          underline: {
            type: Type.BOOLEAN,
            description: 'True if underlined.',
          },
          allCaps: {
            type: Type.BOOLEAN,
            description: 'True if rendered in uppercase letters.',
          },
          colorHex: {
            type: Type.STRING,
            description:
              'Exact sampled ink color in 6-digit hex (e.g. "#1A1A1A", "#334155", "#FFFFFF", "#B91C1C").',
          },
          backgroundColorHex: {
            type: Type.STRING,
            description:
              'Optional 6-digit hex background fill ONLY if this text block itself has a tightly fitted colored highlight/box directly behind it; otherwise "none" (use visualElements rectangle for larger panels behind multiple lines).',
          },
          borderColorHex: {
            type: Type.STRING,
            description: 'Optional 6-digit hex border color around this text box, or "none".',
          },
          borderWidthPt: {
            type: Type.NUMBER,
            description: 'Optional border width in points if borderColorHex is set.',
          },
          alignment: {
            type: Type.STRING,
            description: 'One of: "left", "center", "right", "justify".',
          },
          spacingAfterPt: {
            type: Type.NUMBER,
            description: 'Vertical spacing after this paragraph in points for flowing mode.',
          },
          box2d: {
            type: Type.ARRAY,
            description:
              'Very tight, exact bounding box [ymin, xmin, ymax, xmax] (0 to 1000 in full image coordinates) surrounding ONLY this text block.',
            items: { type: Type.INTEGER },
          },
          spans: {
            type: Type.ARRAY,
            description:
              'Optional inline runs ONLY when this block mixes different colors, weights, italics, or fonts within the same block. Concatenate to exact text.',
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                bold: { type: Type.BOOLEAN },
                italic: { type: Type.BOOLEAN },
                underline: { type: Type.BOOLEAN },
                colorHex: { type: Type.STRING },
                fontFamily: { type: Type.STRING },
                fontSizePt: { type: Type.NUMBER },
              },
              required: ['text'],
            },
          },
        },
        required: [
          'text',
          'role',
          'detectedFont',
          'fontSizePt',
          'lineCount',
          'lineHeight',
          'letterSpacingPt',
          'bold',
          'italic',
          'underline',
          'allCaps',
          'colorHex',
          'alignment',
          'spacingAfterPt',
          'box2d',
        ],
      },
    },
  },
  required: [
    'documentTitle',
    'suggestedFilename',
    'language',
    'pageOrientation',
    'pageBounds',
    'pageBackgroundHex',
    'summary',
    'detectedFonts',
    'visualElements',
    'blocks',
  ],
};

const SYSTEM_INSTRUCTION = `You are a precision document layout engineer, forensic typographer, and optical replica specialist.
Your mission is to analyze an uploaded photograph of a printed page, poster, memo, or typed document so our system can reconstruct a 100% visually faithful Microsoft Word (.docx) replica with exact positions, sizes, colors, fonts, embedded images, and rules.

Follow these strict engineering rules:
1. PAGE BOUNDS & BACKGROUND:
   - Identify pageBounds [ymin, xmin, ymax, xmax] (0–1000) tightly framing the main printed page/document (excluding surrounding wooden desk, table, or adjacent blank book page across the gutter). If the entire image is already a clean full-bleed page/poster/screenshot, return [0, 0, 1000, 1000].
   - Sample pageBackgroundHex accurately (e.g. warm cream paper "#F4F2EC", crisp white "#FFFFFF", dark poster "#12151C").

2. EXACT SPATIAL SEPARATION (CRITICAL):
   - NEVER merge horizontally separate text regions into a single block. For example: a left-aligned footer ("ARCADE | Winter 2024") and a right-aligned page number ("47") on the same baseline MUST be TWO separate blocks with their own tight box2d!
   - Likewise, multi-column layouts, table cells, sidebars, and distinct header/logo/date corners MUST each be their own separate block with exact box2d.
   - Make every box2d [ymin, xmin, ymax, xmax] as tight and spatially accurate as possible around the ink bounds of that element.

3. EXACT FONTS, SIZES, COLORS & SPACING:
   - Accurately classify every distinct typeface family by inspecting serif brackets, stroke contrast, terminals, x-height, and apertures. Group bold/italic variants under one family in detectedFonts.
   - Measure fontSizePt proportionally as if the detected page width were 8.5 inches (612 pt). Count exact visual lineCount and estimate lineHeight (e.g. 1.15–1.55) and letterSpacingPt.
   - Sample exact ink colorHex for every block (dark ink vs muted gray captions vs colored headings vs white text on dark banners).
   - If a single text block contains mixed inline formatting (e.g. a bold phrase or colored word inside normal prose), populate spans[] covering the entire text accurately.
   - Preserve explicit "\\n" line breaks inside centered display titles, addresses, or monospace code/reference lines so line breaks match the picture identically.

4. VISUAL ELEMENTS (PHOTOS, RULES, SHADED PANELS):
   - Detect every embedded photograph, illustration, chart, or graphic inside pageBounds as visualElements with kind: "image" and a tight box2d.
   - Detect every horizontal/vertical divider line as kind: "line" with exact fillColorHex and borderWidthPt.
   - Detect every colored banner, shaded callout panel, or card box behind text as kind: "rectangle" with exact fillColorHex and optional borderColorHex.
   - Do not fabricate elements that are not visible in the photo.`;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes('503') ||
        message.includes('500') ||
        message.includes('UNAVAILABLE') ||
        message.includes('fetch failed') ||
        message.includes('ECONNRESET');
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

export async function analyzeDocumentPhoto(
  base64Data: string,
  mimeType: string,
  dimensions?: { width?: number; height?: number }
): Promise<AnalysisResult> {
  const ai = getGeminiClient();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: 'Perform a 1:1 visual layout and typography forensic scan of this image. Return exact pageBounds, pageBackgroundHex, every visual element (embedded photos, shaded rectangles, divider lines), every font family, and every positioned text block with exact box2d, lineCount, fontSizePt, lineHeight, letterSpacingPt, colorHex, and alignment so our Word (.docx) generator recreates the exact format of this picture.',
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      },
    })
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('The analysis service returned an empty response.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Failed to parse typographic analysis response.');
  }

  const pageBounds: [number, number, number, number] =
    normalizeBox2d(parsed.pageBounds) ?? [0, 0, 1000, 1000];

  const [pYmin, pXmin, pYmax, pXmax] = pageBounds;
  const imgW =
    dimensions?.width && dimensions.width > 0 ? dimensions.width : 1000;
  const imgH =
    dimensions?.height && dimensions.height > 0 ? dimensions.height : 1294;
  const actualPagePxW = ((pXmax - pXmin) / 1000) * imgW;
  const actualPagePxH = ((pYmax - pYmin) / 1000) * imgH;
  const pageAspectRatio = round2(
    clamp(actualPagePxW / Math.max(1, actualPagePxH), 0.45, 2.2)
  );

  const pageOrientation: 'portrait' | 'landscape' =
    pageAspectRatio > 1.05
      ? 'landscape'
      : parsed.pageOrientation === 'landscape' && pageAspectRatio >= 0.95
        ? 'landscape'
        : 'portrait';

  const pageWidthPt = pageOrientation === 'landscape' ? 11 * 72 : 8.5 * 72;
  const pageHeightPt = pageWidthPt / pageAspectRatio;
  const pageBackgroundHex = normalizeHex(parsed.pageBackgroundHex, '#FFFFFF');

  const rawFonts = Array.isArray(parsed.detectedFonts)
    ? (parsed.detectedFonts as Record<string, unknown>[])
    : [];

  const detectedFonts: DetectedFont[] = rawFonts.map((f, index) => {
    const detectedName =
      typeof f.detectedName === 'string' && f.detectedName.trim()
        ? f.detectedName.trim()
        : `Detected Font ${index + 1}`;
    const wordFont =
      typeof f.wordFont === 'string' && f.wordFont.trim()
        ? f.wordFont.trim()
        : 'Georgia';
    const googleFont =
      typeof f.googleFont === 'string' && f.googleFont.trim()
        ? f.googleFont.trim()
        : wordFont;
    const rawCat = typeof f.category === 'string' ? f.category.trim() : 'Serif';
    const category: FontCategory = VALID_CATEGORIES.has(rawCat as FontCategory)
      ? (rawCat as FontCategory)
      : 'Serif';

    return {
      id: slugifyFontId(detectedName, index),
      detectedName,
      wordFont,
      googleFont,
      category,
      confidence: clamp(Math.round(Number(f.confidence) || 85), 50, 99),
      characteristics:
        typeof f.characteristics === 'string' && f.characteristics.trim()
          ? f.characteristics.trim()
          : 'Clean printed letterforms with balanced proportions.',
      sampleText:
        typeof f.sampleText === 'string' && f.sampleText.trim()
          ? f.sampleText.trim()
          : detectedName,
      usageCount: 0,
    };
  });

  const ensureFontMatch = (name: string): DetectedFont => {
    const normalized = name.trim().toLowerCase();
    const existing = detectedFonts.find(
      (f) =>
        f.detectedName.toLowerCase() === normalized ||
        f.wordFont.toLowerCase() === normalized
    );
    if (existing) return existing;
    if (detectedFonts.length > 0) return detectedFonts[0];
    const fallback: DetectedFont = {
      id: 'font-default-serif',
      detectedName: name.trim() || 'Georgia',
      wordFont: 'Georgia',
      googleFont: 'Lora',
      category: 'Serif',
      confidence: 80,
      characteristics: 'Standard editorial typeface.',
      sampleText: 'Sample text',
      usageCount: 0,
    };
    detectedFonts.push(fallback);
    return fallback;
  };

  const rawVisuals = Array.isArray(parsed.visualElements)
    ? (parsed.visualElements as Record<string, unknown>[])
    : [];

  const visualElements: VisualElement[] = [];
  rawVisuals.forEach((v, index) => {
    const box2d = normalizeBox2d(v.box2d);
    if (!box2d) return;
    const kind =
      v.kind === 'image' || v.kind === 'rectangle' || v.kind === 'line'
        ? v.kind
        : null;
    if (!kind) return;

    const layout = boxToPageLayout(box2d, pageBounds);
    // Ignore accidental full-page background rectangles duplicated in visualElements
    if (kind === 'rectangle' && layout.widthPct > 94 && layout.heightPct > 94) {
      return;
    }

    visualElements.push({
      id: `visual-${index + 1}`,
      kind,
      label:
        typeof v.label === 'string' && v.label.trim()
          ? v.label.trim()
          : kind === 'image'
            ? 'Embedded image'
            : kind === 'line'
              ? 'Divider rule'
              : 'Shaded panel',
      box2d,
      layout,
      fillColorHex:
        kind === 'image'
          ? undefined
          : normalizeOptionalHex(v.fillColorHex) ||
            (kind === 'line' ? '#1E293B' : '#F1F5F9'),
      borderColorHex: normalizeOptionalHex(v.borderColorHex),
      borderWidthPt:
        typeof v.borderWidthPt === 'number' && Number.isFinite(v.borderWidthPt)
          ? clamp(v.borderWidthPt, 0.5, 12)
          : kind === 'line'
            ? 1.5
            : undefined,
    });
  });

  const rawBlocks = Array.isArray(parsed.blocks)
    ? (parsed.blocks as Record<string, unknown>[])
    : [];

  const blocks: TextBlock[] = rawBlocks
    .filter((b) => typeof b.text === 'string' && b.text.trim().length > 0)
    .map((b, index) => {
      const fontName =
        typeof b.detectedFont === 'string' && b.detectedFont.trim()
          ? b.detectedFont.trim()
          : detectedFonts[0]?.detectedName || 'Georgia';
      const matchedFont = ensureFontMatch(fontName);
      matchedFont.usageCount += 1;

      const rawRole = typeof b.role === 'string' ? b.role.trim() : 'paragraph';
      const role: TextRole = VALID_ROLES.has(rawRole as TextRole)
        ? (rawRole as TextRole)
        : 'paragraph';

      const rawAlign =
        typeof b.alignment === 'string' ? b.alignment.trim() : 'left';
      const alignment: TextAlignment = VALID_ALIGNMENTS.has(
        rawAlign as TextAlignment
      )
        ? (rawAlign as TextAlignment)
        : 'left';

      const box2d = normalizeBox2d(b.box2d);
      const layout: LayoutBox = box2d
        ? boxToPageLayout(box2d, pageBounds)
        : {
            xPct: 10,
            yPct: clamp(8 + index * 10, 4, 90),
            widthPct: 80,
            heightPct: 6,
          };

      const lineCount = clamp(
        Math.round(Number(b.lineCount) || String(b.text).split('\n').length || 1),
        1,
        60
      );
      const lineHeight = round2(
        clamp(
          Number(b.lineHeight) ||
            (role === 'title' || role === 'heading1' ? 1.18 : 1.42),
          1.0,
          2.2
        )
      );

      const fontSizePt = calibrateFontSizePt({
        rawPt: Number(b.fontSizePt) || 11,
        layoutHeightPct: layout.heightPct,
        lineCount,
        lineHeight,
        pageHeightPt,
      });

      const letterSpacingPt = round2(
        clamp(Number(b.letterSpacingPt) || 0, -1, 8)
      );

      let spans: TextSpan[] | undefined;
      if (Array.isArray(b.spans) && b.spans.length > 1) {
        const parsedSpans: TextSpan[] = [];
        for (const s of b.spans as Record<string, unknown>[]) {
          if (typeof s.text !== 'string' || s.text.length === 0) continue;
          parsedSpans.push({
            text: s.text,
            bold: typeof s.bold === 'boolean' ? s.bold : undefined,
            italic: typeof s.italic === 'boolean' ? s.italic : undefined,
            underline:
              typeof s.underline === 'boolean' ? s.underline : undefined,
            colorHex: normalizeOptionalHex(s.colorHex),
            fontFamily:
              typeof s.fontFamily === 'string' && s.fontFamily.trim()
                ? s.fontFamily.trim()
                : undefined,
            fontSizePt:
              typeof s.fontSizePt === 'number' && Number.isFinite(s.fontSizePt)
                ? clamp(s.fontSizePt, 6, 96)
                : undefined,
          });
        }
        if (parsedSpans.length > 1) {
          spans = parsedSpans;
        }
      }

      return {
        id: `block-${index + 1}`,
        text: String(b.text).trim(),
        role,
        fontId: matchedFont.id,
        detectedFont: matchedFont.detectedName,
        wordFont: matchedFont.wordFont,
        googleFont: matchedFont.googleFont,
        fontSizePt,
        lineCount,
        lineHeight,
        letterSpacingPt,
        bold: Boolean(b.bold),
        italic: Boolean(b.italic),
        underline: Boolean(b.underline),
        allCaps: Boolean(b.allCaps),
        colorHex: normalizeHex(b.colorHex, '#1A1A1A'),
        backgroundColorHex: normalizeOptionalHex(b.backgroundColorHex),
        borderColorHex: normalizeOptionalHex(b.borderColorHex),
        borderWidthPt:
          typeof b.borderWidthPt === 'number' &&
          Number.isFinite(b.borderWidthPt)
            ? clamp(b.borderWidthPt, 0.5, 8)
            : undefined,
        alignment,
        spacingAfterPt: clamp(Math.round(Number(b.spacingAfterPt) || 8), 0, 36),
        box2d,
        layout,
        spans,
      };
    });

  const documentTitle =
    typeof parsed.documentTitle === 'string' && parsed.documentTitle.trim()
      ? parsed.documentTitle.trim()
      : 'Untitled Document';

  const rawSlug =
    typeof parsed.suggestedFilename === 'string' &&
    parsed.suggestedFilename.trim()
      ? parsed.suggestedFilename.trim()
      : documentTitle;

  const suggestedFilename =
    rawSlug
      .toLowerCase()
      .replace(/\.docx$/i, '')
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'detected-document';

  return {
    documentTitle,
    suggestedFilename,
    language:
      typeof parsed.language === 'string' && parsed.language.trim()
        ? parsed.language.trim()
        : 'English',
    pageOrientation,
    pageBounds,
    pageBackgroundHex,
    pageAspectRatio,
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : `Extracted ${blocks.length} positioned text blocks across ${detectedFonts.length} font families.`,
    detectedFonts,
    blocks,
    visualElements,
  };
}
