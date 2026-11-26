import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeDocumentPhoto } from './server/gemini.ts';
import { buildWordDocument } from './server/docxBuilder.ts';
import type {
  DetectedFont,
  ExportOptions,
  TextBlock,
  VisualElement,
} from './src/types/typography.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .replace(/\.docx$/i, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || 'typepress-document';
}

function classifyError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('gemini_api_key is not configured')
  ) {
    return {
      status: 403,
      message:
        'Gemini API access failed. Please verify your API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message:
        'API quota limit reached. Please wait a moment or check your billing-enabled key in Settings > Secrets.',
    };
  }
  if (lower.includes('invalid argument') || lower.includes('400')) {
    return {
      status: 400,
      message:
        'The uploaded image could not be processed. Please try a clearer JPG or PNG photo.',
    };
  }
  return {
    status: 500,
    message: raw || 'An unexpected error occurred while processing the request.',
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/analyze-image', async (req, res) => {
    try {
      const { imageBase64, mimeType, imageWidth, imageHeight } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        imageWidth?: number;
        imageHeight?: number;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing image payload.' });
        return;
      }

      const normalizedMime =
        typeof mimeType === 'string'
          ? mimeType.toLowerCase().trim()
          : 'image/jpeg';
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(400).json({
          error:
            'Unsupported image format. Please upload a PNG, JPG, or WEBP photo.',
        });
        return;
      }

      const strippedBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      if (!strippedBase64 || strippedBase64.length < 32) {
        res.status(400).json({ error: 'Uploaded image appears to be empty.' });
        return;
      }

      const effectiveMime =
        normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;

      const result = await analyzeDocumentPhoto(strippedBase64, effectiveMime, {
        width: typeof imageWidth === 'number' ? imageWidth : undefined,
        height: typeof imageHeight === 'number' ? imageHeight : undefined,
      });
      res.json(result);
    } catch (error) {
      const { status, message } = classifyError(error);
      console.error('[api/analyze-image]', error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/generate-docx', async (req, res) => {
    try {
      const {
        documentTitle,
        blocks,
        detectedFonts,
        visualElements,
        options,
        pageBackgroundHex,
        pageOrientation,
        pageAspectRatio,
      } = req.body as {
        documentTitle?: string;
        blocks?: TextBlock[];
        detectedFonts?: DetectedFont[];
        visualElements?: VisualElement[];
        options?: Partial<ExportOptions>;
        pageBackgroundHex?: string;
        pageOrientation?: 'portrait' | 'landscape';
        pageAspectRatio?: number;
      };

      if (!Array.isArray(blocks) || blocks.length === 0) {
        res.status(400).json({
          error:
            'At least one text block is required to generate a Word document.',
        });
        return;
      }

      const safeOptions: ExportOptions = {
        filename: sanitizeFilename(
          options?.filename || documentTitle || 'typepress-document'
        ),
        layoutMode: options?.layoutMode === 'flowing' ? 'flowing' : 'exact',
        pageSize:
          options?.pageSize === 'a4'
            ? 'a4'
            : options?.pageSize === 'letter'
              ? 'letter'
              : 'match-photo',
        fontStrategy:
          options?.fontStrategy === 'word-safe' ? 'word-safe' : 'detected',
        includeBackground: options?.includeBackground !== false,
        includeVisualElements: options?.includeVisualElements !== false,
        includeFontReport: Boolean(options?.includeFontReport),
        marginInches:
          typeof options?.marginInches === 'number' &&
          Number.isFinite(options.marginInches)
            ? options.marginInches
            : 1.0,
      };

      const buffer = await buildWordDocument({
        documentTitle: documentTitle || 'TypePress Document',
        blocks,
        detectedFonts: Array.isArray(detectedFonts) ? detectedFonts : [],
        visualElements: Array.isArray(visualElements) ? visualElements : [],
        options: safeOptions,
        pageBackgroundHex:
          typeof pageBackgroundHex === 'string' ? pageBackgroundHex : '#FFFFFF',
        pageOrientation:
          pageOrientation === 'landscape' ? 'landscape' : 'portrait',
        pageAspectRatio:
          typeof pageAspectRatio === 'number' ? pageAspectRatio : undefined,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeOptions.filename}.docx"`
      );
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (error) {
      console.error('[api/generate-docx]', error);
      res.status(500).json({
        error: 'Could not generate the Word document. Please try again.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TypePress server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
