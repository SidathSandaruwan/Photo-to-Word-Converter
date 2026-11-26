import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  UnderlineType,
  VerticalPositionRelativeFrom,
  WidthType,
  convertInchesToTwip,
  type ISectionOptions,
} from 'docx';
import { ShapeRun } from 'docx/shapes';
import type {
  DetectedFont,
  ExportOptions,
  TextAlignment,
  TextBlock,
  TextRole,
  VisualElement,
} from '../src/types/typography.ts';

const EMU_PER_INCH = 914400;
const PX_PER_INCH = 96;

function mapAlignment(alignment: TextAlignment) {
  switch (alignment) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    case 'left':
    default:
      return AlignmentType.LEFT;
  }
}

function mapHeading(role: TextRole) {
  switch (role) {
    case 'title':
      return HeadingLevel.TITLE;
    case 'heading1':
      return HeadingLevel.HEADING_1;
    case 'heading2':
      return HeadingLevel.HEADING_2;
    default:
      return undefined;
  }
}

function cleanColorHex(hex: string | undefined, fallback = '1A1A1A'): string {
  const cleaned = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return fallback;
}

function resolveBlockFontName(
  block: TextBlock,
  strategy: 'detected' | 'word-safe'
): string {
  if (strategy === 'detected') {
    return block.detectedFont?.trim() || block.wordFont?.trim() || 'Georgia';
  }
  return block.wordFont?.trim() || block.detectedFont?.trim() || 'Georgia';
}

function resolvePageDimensionsInches(params: {
  pageSize: ExportOptions['pageSize'];
  pageOrientation: 'portrait' | 'landscape';
  pageAspectRatio?: number;
}): { widthIn: number; heightIn: number; isLandscape: boolean } {
  const { pageSize, pageOrientation, pageAspectRatio } = params;
  const aspect =
    pageAspectRatio && Number.isFinite(pageAspectRatio) && pageAspectRatio > 0.4
      ? Math.min(2.2, Math.max(0.45, pageAspectRatio))
      : 8.5 / 11;

  if (pageSize === 'match-photo') {
    const isLandscape = aspect > 1.05 || pageOrientation === 'landscape';
    if (isLandscape) {
      const widthIn = 11.0;
      const heightIn = Math.min(14.0, Math.max(4.5, widthIn / aspect));
      return { widthIn, heightIn, isLandscape: true };
    }
    const widthIn = 8.5;
    const heightIn = Math.min(16.0, Math.max(5.0, widthIn / aspect));
    return { widthIn, heightIn, isLandscape: false };
  }

  const baseW = pageSize === 'a4' ? 8.268 : 8.5;
  const baseH = pageSize === 'a4' ? 11.693 : 11.0;
  const isLandscape = pageOrientation === 'landscape';
  return isLandscape
    ? { widthIn: baseH, heightIn: baseW, isLandscape: true }
    : { widthIn: baseW, heightIn: baseH, isLandscape: false };
}

function buildTextRunsForBlock(
  block: TextBlock,
  fontName: string
): TextRun[] {
  const baseHalfPoints = Math.max(
    12,
    Math.min(192, Math.round(block.fontSizePt * 2))
  );
  const baseColor = cleanColorHex(block.colorHex, '1A1A1A');
  const charSpacingTwips =
    block.letterSpacingPt && Number.isFinite(block.letterSpacingPt)
      ? Math.round(block.letterSpacingPt * 20)
      : undefined;

  if (Array.isArray(block.spans) && block.spans.length > 1) {
    const runs: TextRun[] = [];
    for (const span of block.spans) {
      const spanFont = span.fontFamily?.trim() || fontName;
      const spanColor = cleanColorHex(span.colorHex, baseColor);
      const spanHalfPts = span.fontSizePt
        ? Math.max(12, Math.min(192, Math.round(span.fontSizePt * 2)))
        : baseHalfPoints;
      const spanBold = span.bold ?? block.bold;
      const spanItalic = span.italic ?? block.italic;
      const spanUnderline = span.underline ?? block.underline;

      const lines = span.text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        runs.push(
          new TextRun({
            text: line,
            break: idx > 0 ? 1 : undefined,
            font: {
              name: spanFont,
              ascii: spanFont,
              hAnsi: spanFont,
              cs: spanFont,
            },
            size: spanHalfPts,
            bold: spanBold,
            italics: spanItalic,
            allCaps: block.allCaps,
            characterSpacing: charSpacingTwips,
            underline: spanUnderline
              ? { type: UnderlineType.SINGLE, color: spanColor }
              : undefined,
            color: spanColor,
          })
        );
      });
    }
    if (runs.length > 0) return runs;
  }

  const lines = block.text.split(/\r?\n/);
  return lines.map((line, index) => {
    const prefix = block.role === 'list_item' && index === 0 ? '• ' : '';
    return new TextRun({
      text: `${prefix}${line}`,
      break: index > 0 ? 1 : undefined,
      font: {
        name: fontName,
        ascii: fontName,
        hAnsi: fontName,
        cs: fontName,
      },
      size: baseHalfPoints,
      bold: block.bold,
      italics: block.italic,
      allCaps: block.allCaps,
      characterSpacing: charSpacingTwips,
      underline: block.underline
        ? { type: UnderlineType.SINGLE, color: baseColor }
        : undefined,
      color: baseColor,
    });
  });
}

function decodeImageDataUrl(
  dataUrl: string
): { buffer: Buffer; type: 'png' | 'jpg' } | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) return null;
  const rawFormat = match[1].toLowerCase();
  const type = rawFormat === 'png' ? 'png' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length < 16) return null;
  return { buffer, type };
}

function buildExactReplicaSection(params: {
  blocks: TextBlock[];
  visualElements: VisualElement[];
  options: ExportOptions;
  pageBackgroundHex: string;
  pageOrientation: 'portrait' | 'landscape';
  pageAspectRatio?: number;
}): ISectionOptions {
  const {
    blocks,
    visualElements,
    options,
    pageBackgroundHex,
    pageOrientation,
    pageAspectRatio,
  } = params;

  const { widthIn, heightIn, isLandscape } = resolvePageDimensionsInches({
    pageSize: options.pageSize,
    pageOrientation,
    pageAspectRatio,
  });

  const pageWidthTwips = convertInchesToTwip(widthIn);
  const pageHeightTwips = convertInchesToTwip(heightIn);
  const pageWidthPx = Math.round(widthIn * PX_PER_INCH);
  const pageHeightPx = Math.round(heightIn * PX_PER_INCH);

  const floatingRuns: Array<ShapeRun | ImageRun> = [];

  // Layer 0: Full-page background rectangle so Print Layout & PDF export always match the paper/poster color
  const bgHex = cleanColorHex(pageBackgroundHex, 'FFFFFF');
  if (options.includeBackground && bgHex !== 'FFFFFF') {
    floatingRuns.push(
      new ShapeRun({
        type: 'rectangle',
        transformation: {
          width: pageWidthPx + 4,
          height: pageHeightPx + 4,
        },
        fill: bgHex,
        line: 'none',
        floating: {
          horizontalPosition: {
            relative: HorizontalPositionRelativeFrom.PAGE,
            offset: 0,
          },
          verticalPosition: {
            relative: VerticalPositionRelativeFrom.PAGE,
            offset: 0,
          },
          wrap: { type: TextWrappingType.NONE },
          allowOverlap: true,
          behindDocument: true,
          zIndex: 0,
        },
      })
    );
  }

  // Layer 1 & 2: Non-text visual elements (shaded panels, divider lines, embedded cropped images)
  if (options.includeVisualElements && Array.isArray(visualElements)) {
    visualElements.forEach((el, idx) => {
      const xPct = Math.max(0, Math.min(99, el.layout.xPct));
      const yPct = Math.max(0, Math.min(99, el.layout.yPct));
      const wPct = Math.max(0.5, Math.min(100 - xPct, el.layout.widthPct));
      const hPct = Math.max(0.15, Math.min(100 - yPct, el.layout.heightPct));

      const xEmu = Math.round((xPct / 100) * widthIn * EMU_PER_INCH);
      const yEmu = Math.round((yPct / 100) * heightIn * EMU_PER_INCH);
      const widthPx = Math.max(2, Math.round((wPct / 100) * pageWidthPx));
      const heightPx = Math.max(
        el.kind === 'line' ? 1 : 4,
        Math.round((hPct / 100) * pageHeightPx)
      );

      if (el.kind === 'image' && el.croppedDataUrl) {
        const decoded = decodeImageDataUrl(el.croppedDataUrl);
        if (decoded) {
          floatingRuns.push(
            new ImageRun({
              type: decoded.type,
              data: decoded.buffer,
              transformation: {
                width: widthPx,
                height: heightPx,
              },
              floating: {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.PAGE,
                  offset: xEmu,
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.PAGE,
                  offset: yEmu,
                },
                wrap: { type: TextWrappingType.NONE },
                allowOverlap: true,
                behindDocument: false,
                zIndex: 20 + idx,
              },
            })
          );
        }
      } else if (el.kind === 'line') {
        const lineColor = cleanColorHex(el.fillColorHex, '1E293B');
        const thicknessPx = Math.max(
          1,
          Math.round((el.borderWidthPt || 1.5) * (96 / 72))
        );
        const isVertical = heightPx > widthPx * 3;
        floatingRuns.push(
          new ShapeRun({
            type: 'rectangle',
            transformation: {
              width: isVertical ? thicknessPx : widthPx,
              height: isVertical ? heightPx : Math.max(thicknessPx, heightPx),
            },
            fill: lineColor,
            line: 'none',
            floating: {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                offset: xEmu,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                offset: yEmu,
              },
              wrap: { type: TextWrappingType.NONE },
              allowOverlap: true,
              behindDocument: false,
              zIndex: 8 + idx,
            },
          })
        );
      } else if (el.kind === 'rectangle') {
        const fillHex = el.fillColorHex
          ? cleanColorHex(el.fillColorHex, 'F1F5F9')
          : 'none';
        const borderHex = el.borderColorHex
          ? cleanColorHex(el.borderColorHex, 'CBD5E1')
          : undefined;
        floatingRuns.push(
          new ShapeRun({
            type: 'rectangle',
            transformation: {
              width: widthPx,
              height: heightPx,
            },
            fill: fillHex,
            line: borderHex
              ? { color: borderHex, width: el.borderWidthPt || 1 }
              : 'none',
            floating: {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                offset: xEmu,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                offset: yEmu,
              },
              wrap: { type: TextWrappingType.NONE },
              allowOverlap: true,
              behindDocument: false,
              zIndex: 4 + idx,
            },
          })
        );
      }
    });
  }

  // Layer 3: Exact-position editable DrawingML TextBox shapes
  blocks.forEach((block, idx) => {
    const fontName = resolveBlockFontName(block, options.fontStrategy);
    const runs = buildTextRunsForBlock(block, fontName);

    const rawXPct = Math.max(0, Math.min(98, block.layout.xPct));
    const rawYPct = Math.max(0, Math.min(98, block.layout.yPct));
    const rawWPct = Math.max(2, Math.min(100 - rawXPct, block.layout.widthPct));
    const rawHPct = Math.max(1, Math.min(100 - rawYPct, block.layout.heightPct));

    // Add tiny horizontal slack (+3% width) so minor font-metric differences between
    // print and Word never force an unwanted extra line wrap while preserving alignment anchor
    const slackPct = block.alignment === 'justify' ? 0.5 : 3.0;
    let adjXPct = rawXPct;
    let adjWPct = rawWPct;

    if (block.alignment === 'center') {
      const halfSlack = Math.min(slackPct / 2, rawXPct, 100 - (rawXPct + rawWPct));
      adjXPct = rawXPct - halfSlack;
      adjWPct = rawWPct + halfSlack * 2;
    } else if (block.alignment === 'right') {
      const leftSlack = Math.min(slackPct, rawXPct);
      adjXPct = rawXPct - leftSlack;
      adjWPct = rawWPct + leftSlack;
    } else {
      adjWPct = Math.min(100 - rawXPct, rawWPct + slackPct);
    }

    const xEmu = Math.round((adjXPct / 100) * widthIn * EMU_PER_INCH);
    const yEmu = Math.round((rawYPct / 100) * heightIn * EMU_PER_INCH);
    const widthPx = Math.max(20, Math.round((adjWPct / 100) * pageWidthPx));
    const heightPx = Math.max(12, Math.round((rawHPct / 100) * pageHeightPx));

    const lineMultiplier =
      block.lineHeight && Number.isFinite(block.lineHeight)
        ? Math.min(2.2, Math.max(1.0, block.lineHeight))
        : 1.3;
    const lineTwips = Math.round(lineMultiplier * 240);

    const hasBoxFill = Boolean(block.backgroundColorHex);
    const hasBoxBorder = Boolean(block.borderColorHex);

    const innerParagraph = new Paragraph({
      alignment: mapAlignment(block.alignment),
      spacing: {
        before: 0,
        after: 0,
        line: lineTwips,
        lineRule: LineRuleType.AUTO,
      },
      children: runs,
    });

    floatingRuns.push(
      new ShapeRun({
        type: 'rectangle',
        transformation: {
          width: widthPx,
          height: heightPx,
        },
        fill: hasBoxFill
          ? cleanColorHex(block.backgroundColorHex, 'F1F5F9')
          : 'none',
        line: hasBoxBorder
          ? {
              color: cleanColorHex(block.borderColorHex, 'CBD5E1'),
              width: block.borderWidthPt || 1,
            }
          : 'none',
        textOptions: {
          verticalAlignment: 'top',
          margins:
            hasBoxFill || hasBoxBorder
              ? { top: 3, right: 5, bottom: 3, left: 5 }
              : { top: 0, right: 0, bottom: 0, left: 0 },
          wrap: true,
          resizeShapeToFitText: true,
        },
        floating: {
          horizontalPosition: {
            relative: HorizontalPositionRelativeFrom.PAGE,
            offset: xEmu,
          },
          verticalPosition: {
            relative: VerticalPositionRelativeFrom.PAGE,
            offset: yEmu,
          },
          wrap: { type: TextWrappingType.NONE },
          allowOverlap: true,
          behindDocument: false,
          zIndex: 50 + idx,
        },
        children: [innerParagraph],
      })
    );
  });

  return {
    properties: {
      page: {
        size: {
          width: pageWidthTwips,
          height: pageHeightTwips,
          orientation: isLandscape
            ? PageOrientation.LANDSCAPE
            : PageOrientation.PORTRAIT,
        },
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 240 },
        children: floatingRuns,
      }),
    ],
  };
}

function buildFlowingSection(params: {
  blocks: TextBlock[];
  options: ExportOptions;
  pageOrientation: 'portrait' | 'landscape';
  pageAspectRatio?: number;
}): ISectionOptions {
  const { blocks, options, pageOrientation, pageAspectRatio } = params;
  const marginInches = Math.min(
    1.5,
    Math.max(0.4, Number(options.marginInches) || 1.0)
  );
  const marginTwip = convertInchesToTwip(marginInches);
  const { widthIn, heightIn, isLandscape } = resolvePageDimensionsInches({
    pageSize: options.pageSize === 'match-photo' ? 'letter' : options.pageSize,
    pageOrientation,
    pageAspectRatio,
  });

  const children = blocks.map((block) => {
    const fontName = resolveBlockFontName(block, options.fontStrategy);
    const runs = buildTextRunsForBlock(block, fontName);
    const afterTwips = Math.max(
      0,
      Math.min(720, Math.round(block.spacingAfterPt * 20))
    );
    const lineTwips = Math.round(
      Math.min(2.2, Math.max(1.05, block.lineHeight || 1.35)) * 240
    );

    return new Paragraph({
      heading: mapHeading(block.role),
      alignment: mapAlignment(block.alignment),
      indent:
        block.role === 'quote'
          ? {
              left: convertInchesToTwip(0.45),
              right: convertInchesToTwip(0.35),
            }
          : undefined,
      shading: block.backgroundColorHex
        ? {
            type: ShadingType.SOLID,
            fill: cleanColorHex(block.backgroundColorHex, 'F1F5F9'),
            color: cleanColorHex(block.backgroundColorHex, 'F1F5F9'),
          }
        : undefined,
      spacing: {
        before:
          block.role === 'heading1'
            ? 200
            : block.role === 'heading2'
              ? 140
              : 0,
        after: afterTwips,
        line: lineTwips,
        lineRule: LineRuleType.AUTO,
      },
      children: runs,
    });
  });

  return {
    properties: {
      page: {
        size: {
          width: convertInchesToTwip(widthIn),
          height: convertInchesToTwip(heightIn),
          orientation: isLandscape
            ? PageOrientation.LANDSCAPE
            : PageOrientation.PORTRAIT,
        },
        margin: {
          top: marginTwip,
          right: marginTwip,
          bottom: marginTwip,
          left: marginTwip,
        },
      },
    },
    children:
      children.length > 0
        ? children
        : [new Paragraph({ children: [new TextRun({ text: '' })] })],
  };
}

function buildFontReportSection(
  detectedFonts: DetectedFont[],
  strategy: 'detected' | 'word-safe'
): ISectionOptions {
  const headerCellShading = {
    type: ShadingType.SOLID,
    color: 'F1F5F9',
    fill: 'F1F5F9',
  };

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      'Detected Font',
      'Applied in Word',
      'Category',
      'Confidence',
      'Characteristics',
    ].map(
      (label) =>
        new TableCell({
          shading: headerCellShading,
          borders: cellBorders,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 18,
                  color: '0F172A',
                  font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
                }),
              ],
            }),
          ],
        })
    ),
  });

  const dataRows = detectedFonts.map((font) => {
    const appliedFont =
      strategy === 'detected' ? font.detectedName : font.wordFont;
    return new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: font.detectedName,
                  bold: true,
                  size: 19,
                  color: '111827',
                  font: {
                    name: appliedFont,
                    ascii: appliedFont,
                    hAnsi: appliedFont,
                  },
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: appliedFont,
                  size: 18,
                  color: '334155',
                  font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: font.category,
                  size: 18,
                  color: '475569',
                  font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${font.confidence}%`,
                  size: 18,
                  color: '1D4ED8',
                  font: {
                    name: 'Consolas',
                    ascii: 'Consolas',
                    hAnsi: 'Consolas',
                  },
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: cellBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: font.characteristics,
                  size: 17,
                  color: '475569',
                  font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const marginTwip = convertInchesToTwip(0.85);
  return {
    properties: {
      page: {
        size: {
          width: convertInchesToTwip(8.5),
          height: convertInchesToTwip(11.0),
          orientation: PageOrientation.PORTRAIT,
        },
        margin: {
          top: marginTwip,
          right: marginTwip,
          bottom: marginTwip,
          left: marginTwip,
        },
      },
    },
    children: [
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'Detected Typography Report',
            bold: true,
            size: 30,
            color: '0F172A',
            font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 220 },
        children: [
          new TextRun({
            text:
              strategy === 'detected'
                ? 'This document preserves the exact detected typeface names, spatial coordinates, colors, and proportions from the uploaded photo.'
                : 'This document maps each detected typeface to its closest universally installed Microsoft Word equivalent while preserving page formatting.',
            size: 20,
            color: '475569',
            font: { name: 'Calibri', ascii: 'Calibri', hAnsi: 'Calibri' },
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      }),
    ],
  };
}

export async function buildWordDocument(params: {
  documentTitle: string;
  blocks: TextBlock[];
  detectedFonts: DetectedFont[];
  visualElements?: VisualElement[];
  options: ExportOptions;
  pageBackgroundHex?: string;
  pageOrientation?: 'portrait' | 'landscape';
  pageAspectRatio?: number;
}): Promise<Buffer> {
  const {
    documentTitle,
    blocks,
    detectedFonts,
    visualElements = [],
    options,
    pageBackgroundHex = '#FFFFFF',
    pageOrientation = 'portrait',
    pageAspectRatio,
  } = params;

  const primarySection =
    options.layoutMode === 'flowing'
      ? buildFlowingSection({
          blocks,
          options,
          pageOrientation,
          pageAspectRatio,
        })
      : buildExactReplicaSection({
          blocks,
          visualElements,
          options,
          pageBackgroundHex,
          pageOrientation,
          pageAspectRatio,
        });

  const sections: ISectionOptions[] = [primarySection];

  if (options.includeFontReport && detectedFonts.length > 0) {
    sections.push(buildFontReportSection(detectedFonts, options.fontStrategy));
  }

  const bgHex = cleanColorHex(pageBackgroundHex, 'FFFFFF');

  const doc = new Document({
    title: documentTitle || 'TypePress Export',
    creator: 'TypePress',
    description:
      'Generated from uploaded photo with exact layout, colors, and detected typography.',
    background:
      options.includeBackground && bgHex !== 'FFFFFF'
        ? { color: bgHex }
        : undefined,
    sections,
  });

  return await Packer.toBuffer(doc);
}
