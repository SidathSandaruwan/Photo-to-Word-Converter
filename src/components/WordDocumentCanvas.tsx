import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Layers,
  Minus,
  Move,
  Plus,
  Trash2,
  Underline,
} from 'lucide-react';
import type {
  DetectedFont,
  ExportOptions,
  TextAlignment,
  TextBlock,
  VisualElement,
} from '../types/typography.ts';
import {
  WORD_FONT_CATALOG,
  getCssFontStack,
  resolveGoogleFontForName,
} from '../utils/fontCatalog.ts';

interface WordDocumentCanvasProps {
  documentTitle: string;
  blocks: TextBlock[];
  visualElements: VisualElement[];
  detectedFonts: DetectedFont[];
  pageBackgroundHex: string;
  pageAspectRatio: number;
  pageOrientation: 'portrait' | 'landscape';
  pageCropDataUrl?: string;
  exportOptions: ExportOptions;
  isAnalyzing: boolean;
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  highlightedFontId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onHoverBlock: (blockId: string | null) => void;
  onUpdateBlock: (blockId: string, patch: Partial<TextBlock>) => void;
  onAddBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  onChangeLayoutMode: (mode: 'exact' | 'flowing') => void;
}

function AutoResizeTextarea({
  value,
  onChange,
  style,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, style.fontSize, style.fontFamily, style.lineHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      className={className}
    />
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function WordDocumentCanvas({
  documentTitle,
  blocks,
  visualElements,
  detectedFonts,
  pageBackgroundHex,
  pageAspectRatio,
  pageOrientation,
  pageCropDataUrl,
  exportOptions,
  isAnalyzing,
  selectedBlockId,
  hoveredBlockId,
  highlightedFontId,
  onSelectBlock,
  onHoverBlock,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
  onChangeLayoutMode,
}: WordDocumentCanvasProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetWidthPx, setSheetWidthPx] = useState(660);
  const [showGhostOverlay, setShowGhostOverlay] = useState(false);

  // Dragging state for repositioning blocks in Exact Replica mode
  const dragRef = useRef<{
    blockId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    sheetW: number;
    sheetH: number;
  } | null>(null);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100) {
        setSheetWidthPx(rect.width);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [exportOptions.layoutMode, exportOptions.pageSize, pageAspectRatio]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dxPct = ((e.clientX - drag.startClientX) / drag.sheetW) * 100;
      const dyPct = ((e.clientY - drag.startClientY) / drag.sheetH) * 100;
      const block = blocks.find((b) => b.id === drag.blockId);
      if (!block) return;
      const nextX = Math.round(
        clamp(drag.origX + dxPct, 0, Math.max(0, 100 - block.layout.widthPct)) *
          10
      ) / 10;
      const nextY = Math.round(clamp(drag.origY + dyPct, 0, 96) * 10) / 10;
      onUpdateBlock(drag.blockId, {
        layout: {
          ...block.layout,
          xPct: nextX,
          yPct: nextY,
        },
      });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [blocks, onUpdateBlock]);

  const selectedBlock =
    blocks.find((b) => b.id === selectedBlockId) ?? null;

  const fontCategoryById = new Map(
    detectedFonts.map((f) => [f.id, f.category])
  );

  const selectedFontDisplay = selectedBlock
    ? exportOptions.fontStrategy === 'detected'
      ? selectedBlock.detectedFont
      : selectedBlock.wordFont
    : '';

  const allFontOptions = Array.from(
    new Set([
      ...detectedFonts.map((f) => f.detectedName),
      ...detectedFonts.map((f) => f.wordFont),
      ...WORD_FONT_CATALOG.map((f) => f.name),
    ])
  );

  const handleSelectedFontChange = (nextFont: string) => {
    if (!selectedBlock) return;
    const googleFont =
      resolveGoogleFontForName(nextFont) || selectedBlock.googleFont;
    if (exportOptions.fontStrategy === 'detected') {
      onUpdateBlock(selectedBlock.id, {
        detectedFont: nextFont,
        wordFont: nextFont,
        googleFont,
      });
    } else {
      onUpdateBlock(selectedBlock.id, {
        wordFont: nextFont,
        googleFont,
      });
    }
  };

  // Compute exact Word page width in points so on-screen font sizes scale 1:1 with Word!
  const effectiveAspectRatio =
    exportOptions.pageSize === 'letter'
      ? pageOrientation === 'landscape'
        ? 11 / 8.5
        : 8.5 / 11
      : exportOptions.pageSize === 'a4'
        ? pageOrientation === 'landscape'
          ? 11.693 / 8.268
          : 8.268 / 11.693
        : Math.min(2.2, Math.max(0.45, pageAspectRatio || 8.5 / 11));

  const pageWidthPt =
    exportOptions.pageSize === 'a4'
      ? pageOrientation === 'landscape'
        ? 841.9
        : 595.3
      : effectiveAspectRatio > 1.05 || pageOrientation === 'landscape'
        ? 792
        : 612;

  const pxPerPt = sheetWidthPx / pageWidthPt;
  const isExactMode = exportOptions.layoutMode === 'exact';
  const marginPx = Math.round(exportOptions.marginInches * 56);
  const effectiveBg =
    exportOptions.includeBackground && pageBackgroundHex
      ? pageBackgroundHex
      : '#FFFFFF';

  const startDragBlock = (
    e: React.PointerEvent,
    block: TextBlock
  ) => {
    e.stopPropagation();
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;
    const rect = sheetEl.getBoundingClientRect();
    dragRef.current = {
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: block.layout.xPct,
      origY: block.layout.yPct,
      sheetW: rect.width,
      sheetH: rect.height,
    };
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[#F6F7F9]">
      {/* Word formatting & layout toolbar */}
      <div className="min-h-11 px-4 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap shrink-0">
        {selectedBlock ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Font selector */}
            <select
              aria-label="Block font family"
              value={selectedFontDisplay}
              onChange={(e) => handleSelectedFontChange(e.target.value)}
              className="h-8 max-w-[164px] px-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {allFontOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Point size stepper */}
            <div className="inline-flex items-center border border-slate-200 rounded h-8 bg-white">
              <button
                type="button"
                aria-label="Decrease font size"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, {
                    fontSizePt: Math.max(
                      6,
                      Math.round((selectedBlock.fontSizePt - 0.5) * 2) / 2
                    ),
                  })
                }
                className="px-1.5 h-full text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-1.5 text-xs font-mono text-slate-900 tabular-nums whitespace-nowrap">
                {selectedBlock.fontSizePt}pt
              </span>
              <button
                type="button"
                aria-label="Increase font size"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, {
                    fontSizePt: Math.min(
                      96,
                      Math.round((selectedBlock.fontSizePt + 0.5) * 2) / 2
                    ),
                  })
                }
                className="px-1.5 h-full text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="h-4 w-px bg-slate-200" aria-hidden="true" />

            {/* Style toggles */}
            <div className="inline-flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Toggle bold"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, { bold: !selectedBlock.bold })
                }
                className={`w-7 h-8 inline-flex items-center justify-center rounded cursor-pointer transition-colors ${
                  selectedBlock.bold
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Toggle italic"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, {
                    italic: !selectedBlock.italic,
                  })
                }
                className={`w-7 h-8 inline-flex items-center justify-center rounded cursor-pointer transition-colors ${
                  selectedBlock.italic
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Toggle underline"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, {
                    underline: !selectedBlock.underline,
                  })
                }
                className={`w-7 h-8 inline-flex items-center justify-center rounded cursor-pointer transition-colors ${
                  selectedBlock.underline
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Toggle uppercase"
                onClick={() =>
                  onUpdateBlock(selectedBlock.id, {
                    allCaps: !selectedBlock.allCaps,
                  })
                }
                className={`px-1.5 h-8 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                  selectedBlock.allCaps
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                AA
              </button>
            </div>

            <span className="h-4 w-px bg-slate-200" aria-hidden="true" />

            {/* Alignment toggles */}
            <div className="inline-flex items-center gap-0.5">
              {(
                [
                  { value: 'left', icon: AlignLeft, label: 'Align left' },
                  { value: 'center', icon: AlignCenter, label: 'Align center' },
                  { value: 'right', icon: AlignRight, label: 'Align right' },
                  {
                    value: 'justify',
                    icon: AlignJustify,
                    label: 'Justify text',
                  },
                ] as Array<{
                  value: TextAlignment;
                  icon: typeof AlignLeft;
                  label: string;
                }>
              ).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  onClick={() =>
                    onUpdateBlock(selectedBlock.id, { alignment: value })
                  }
                  className={`w-7 h-8 inline-flex items-center justify-center rounded cursor-pointer transition-colors ${
                    selectedBlock.alignment === value
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <span className="h-4 w-px bg-slate-200" aria-hidden="true" />

            {/* Ink color */}
            <label
              title="Ink color"
              className="inline-flex items-center gap-1.5 px-2 h-8 border border-slate-200 rounded bg-white cursor-pointer"
            >
              <input
                type="color"
                value={selectedBlock.colorHex}
                onChange={(e) =>
                  onUpdateBlock(selectedBlock.id, {
                    colorHex: e.target.value.toUpperCase(),
                  })
                }
                className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                {selectedBlock.colorHex}
              </span>
            </label>

            {/* Exact position / width fine-tune in Exact Replica mode */}
            {isExactMode && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-600 tabular-nums">
                <label className="inline-flex items-center gap-1">
                  <span className="text-slate-400">X</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={98}
                    value={selectedBlock.layout.xPct}
                    onChange={(e) =>
                      onUpdateBlock(selectedBlock.id, {
                        layout: {
                          ...selectedBlock.layout,
                          xPct: clamp(Number(e.target.value) || 0, 0, 98),
                        },
                      })
                    }
                    className="w-12 h-7 px-1 text-right bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </label>
                <label className="inline-flex items-center gap-1">
                  <span className="text-slate-400">Y</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={98}
                    value={selectedBlock.layout.yPct}
                    onChange={(e) =>
                      onUpdateBlock(selectedBlock.id, {
                        layout: {
                          ...selectedBlock.layout,
                          yPct: clamp(Number(e.target.value) || 0, 0, 98),
                        },
                      })
                    }
                    className="w-12 h-7 px-1 text-right bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </label>
                <label className="inline-flex items-center gap-1">
                  <span className="text-slate-400">W</span>
                  <input
                    type="number"
                    step={1}
                    min={2}
                    max={100}
                    value={selectedBlock.layout.widthPct}
                    onChange={(e) =>
                      onUpdateBlock(selectedBlock.id, {
                        layout: {
                          ...selectedBlock.layout,
                          widthPct: clamp(Number(e.target.value) || 10, 2, 100),
                        },
                      })
                    }
                    className="w-12 h-7 px-1 text-right bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              aria-label="Delete selected block"
              onClick={() => onDeleteBlock(selectedBlock.id)}
              className="w-7 h-8 inline-flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
              Word document preview
            </span>

            {/* Layout mode segmented control */}
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => onChangeLayoutMode('exact')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  isExactMode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exact replica
              </button>
              <button
                type="button"
                onClick={() => onChangeLayoutMode('flowing')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  !isExactMode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Flowing text
              </button>
            </div>

            {isExactMode && pageCropDataUrl && !isAnalyzing && (
              <button
                type="button"
                onClick={() => setShowGhostOverlay((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  showGhostOverlay
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {showGhostOverlay ? 'Hide photo trace' : 'Compare photo'}
              </button>
            )}
          </div>
        )}

        {!isAnalyzing && (
          <button
            type="button"
            onClick={onAddBlock}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add block
          </button>
        )}
      </div>

      {/* Scrollable paper sheet viewport */}
      <div
        className="flex-1 overflow-y-auto p-6 sm:p-8 flex justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectBlock(null);
          }
        }}
      >
        {isExactMode ? (
          /* EXACT 1:1 VISUAL REPLICA SHEET */
          <div
            ref={sheetRef}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onSelectBlock(null);
              }
            }}
            style={{
              aspectRatio: `${effectiveAspectRatio}`,
              backgroundColor: isAnalyzing ? '#FFFFFF' : effectiveBg,
            }}
            className="relative w-full max-w-[700px] border border-slate-200/90 paper-sheet self-start overflow-hidden select-none"
          >
            {/* Optional ghost photo overlay to verify 1:1 alignment */}
            {showGhostOverlay && pageCropDataUrl && !isAnalyzing && (
              <img
                src={pageCropDataUrl}
                alt="Original photo trace overlay"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-fill opacity-30 pointer-events-none z-0"
              />
            )}

            {isAnalyzing ? (
              <div className="p-12 space-y-6 animate-pulse">
                <div className="h-9 w-2/3 bg-slate-200 rounded mx-auto" />
                <div className="h-5 w-1/2 bg-slate-100 rounded mx-auto" />
                <div className="pt-4 space-y-2.5">
                  <div className="h-3.5 w-full bg-slate-100 rounded" />
                  <div className="h-3.5 w-full bg-slate-100 rounded" />
                  <div className="h-3.5 w-5/6 bg-slate-100 rounded" />
                </div>
                <div className="h-44 w-full bg-slate-100 rounded" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No typed text blocks found
                </p>
                <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
                  Try uploading a clearer photograph of typed text, or add a
                  positioned text block manually.
                </p>
                <button
                  type="button"
                  onClick={onAddBlock}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add block
                </button>
              </div>
            ) : (
              <>
                {/* Layer 1 & 2: Visual Elements (Rectangles, Rules, Cropped Embedded Photos) */}
                {exportOptions.includeVisualElements &&
                  visualElements.map((el) => {
                    const boxStyle: React.CSSProperties = {
                      left: `${el.layout.xPct}%`,
                      top: `${el.layout.yPct}%`,
                      width: `${el.layout.widthPct}%`,
                      height: `${el.layout.heightPct}%`,
                    };

                    if (el.kind === 'image' && el.croppedDataUrl) {
                      return (
                        <img
                          key={el.id}
                          src={el.croppedDataUrl}
                          alt={el.label || 'Embedded figure'}
                          referrerPolicy="no-referrer"
                          style={boxStyle}
                          className="absolute object-fill pointer-events-none z-10"
                        />
                      );
                    }

                    if (el.kind === 'line') {
                      const thicknessPx = Math.max(
                        1,
                        (el.borderWidthPt || 1.5) * pxPerPt
                      );
                      const isVertical =
                        el.layout.heightPct > el.layout.widthPct * 3;
                      return (
                        <div
                          key={el.id}
                          aria-hidden="true"
                          style={{
                            ...boxStyle,
                            backgroundColor: el.fillColorHex || '#1E293B',
                            minHeight: isVertical ? undefined : `${thicknessPx}px`,
                            minWidth: isVertical ? `${thicknessPx}px` : undefined,
                          }}
                          className="absolute pointer-events-none z-10"
                        />
                      );
                    }

                    return (
                      <div
                        key={el.id}
                        aria-hidden="true"
                        style={{
                          ...boxStyle,
                          backgroundColor: el.fillColorHex || 'transparent',
                          border: el.borderColorHex
                            ? `${Math.max(1, (el.borderWidthPt || 1) * pxPerPt)}px solid ${el.borderColorHex}`
                            : undefined,
                        }}
                        className="absolute pointer-events-none z-[5]"
                      />
                    );
                  })}

                {/* Layer 3: Exact-position Editable Text Blocks */}
                {blocks.map((block) => {
                  const isSelected = selectedBlockId === block.id;
                  const isHovered = hoveredBlockId === block.id;
                  const isDimmed =
                    Boolean(highlightedFontId) &&
                    block.fontId !== highlightedFontId;

                  const appliedFont =
                    exportOptions.fontStrategy === 'detected'
                      ? block.detectedFont
                      : block.wordFont;
                  const category = fontCategoryById.get(block.fontId);
                  const fontFamily = getCssFontStack(
                    appliedFont,
                    block.googleFont,
                    category
                  );

                  const computedFontSizePx = Math.max(
                    6,
                    block.fontSizePt * pxPerPt
                  );
                  const computedTrackingPx =
                    (block.letterSpacingPt || 0) * pxPerPt;

                  const typographyStyle: React.CSSProperties = {
                    fontFamily,
                    fontSize: `${computedFontSizePx}px`,
                    fontWeight: block.bold ? 700 : 400,
                    fontStyle: block.italic ? 'italic' : 'normal',
                    textDecoration: block.underline ? 'underline' : 'none',
                    textTransform: block.allCaps ? 'uppercase' : 'none',
                    color: block.colorHex,
                    textAlign: block.alignment,
                    lineHeight: block.lineHeight || 1.3,
                    letterSpacing: computedTrackingPx
                      ? `${computedTrackingPx}px`
                      : undefined,
                  };

                  return (
                    <div
                      key={block.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBlock(block.id);
                      }}
                      onMouseEnter={() => onHoverBlock(block.id)}
                      onMouseLeave={() => onHoverBlock(null)}
                      style={{
                        left: `${block.layout.xPct}%`,
                        top: `${block.layout.yPct}%`,
                        width: `${block.layout.widthPct}%`,
                        minHeight: `${block.layout.heightPct}%`,
                        backgroundColor: block.backgroundColorHex || undefined,
                        border: block.borderColorHex
                          ? `${Math.max(1, (block.borderWidthPt || 1) * pxPerPt)}px solid ${block.borderColorHex}`
                          : undefined,
                        padding:
                          block.backgroundColorHex || block.borderColorHex
                            ? `${Math.round(3 * pxPerPt)}px ${Math.round(5 * pxPerPt)}px`
                            : undefined,
                      }}
                      className={`absolute transition-shadow ${
                        isSelected
                          ? 'z-30 ring-1 ring-blue-600 bg-blue-50/20'
                          : isHovered
                            ? 'z-20 ring-1 ring-blue-500/60'
                            : 'z-20'
                      } ${isDimmed ? 'opacity-25' : 'opacity-100'}`}
                    >
                      {/* Drag handle & quiet font tag when selected */}
                      {isSelected && (
                        <div
                          onPointerDown={(e) => startDragBlock(e, block)}
                          title="Drag to adjust exact position"
                          className="absolute -top-5 left-0 inline-flex items-center gap-1.5 px-1.5 py-0.5 bg-blue-700 text-white text-[10px] font-mono tabular-nums rounded-t cursor-grab active:cursor-grabbing whitespace-nowrap select-none shadow-xs"
                        >
                          <Move className="w-2.5 h-2.5" />
                          <span>{appliedFont}</span>
                          <span>&middot;</span>
                          <span>{block.fontSizePt}pt</span>
                        </div>
                      )}

                      {isSelected ? (
                        <AutoResizeTextarea
                          value={block.text}
                          onChange={(nextText) =>
                            onUpdateBlock(block.id, {
                              text: nextText,
                              spans: undefined,
                            })
                          }
                          style={typographyStyle}
                          className="w-full bg-transparent resize-none focus:outline-none overflow-hidden block select-text"
                        />
                      ) : (
                        <div
                          style={typographyStyle}
                          className="w-full whitespace-pre-wrap break-words cursor-text select-text"
                        >
                          {block.role === 'list_item' && (
                            <span aria-hidden="true">&bull; </span>
                          )}
                          {Array.isArray(block.spans) &&
                          block.spans.length > 1 ? (
                            block.spans.map((span, sIdx) => (
                              <span
                                key={sIdx}
                                style={{
                                  fontWeight:
                                    span.bold !== undefined
                                      ? span.bold
                                        ? 700
                                        : 400
                                      : undefined,
                                  fontStyle:
                                    span.italic !== undefined
                                      ? span.italic
                                        ? 'italic'
                                        : 'normal'
                                      : undefined,
                                  textDecoration: span.underline
                                    ? 'underline'
                                    : undefined,
                                  color: span.colorHex || undefined,
                                  fontFamily: span.fontFamily
                                    ? getCssFontStack(
                                        span.fontFamily,
                                        undefined,
                                        category
                                      )
                                    : undefined,
                                  fontSize: span.fontSizePt
                                    ? `${span.fontSizePt * pxPerPt}px`
                                    : undefined,
                                }}
                              >
                                {span.text}
                              </span>
                            ))
                          ) : (
                            block.text
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          /* FLOWING REFLOWABLE PARAGRAPH MODE */
          <div
            ref={sheetRef}
            className={`w-full bg-white border border-slate-200/90 paper-sheet transition-all self-start ${
              exportOptions.pageSize === 'a4'
                ? 'max-w-[710px] min-h-[960px]'
                : 'max-w-[730px] min-h-[940px]'
            }`}
            style={{
              padding: `${marginPx}px`,
              backgroundColor: effectiveBg,
            }}
          >
            <div className="mb-6 pb-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 select-none">
              <span className="truncate">{documentTitle}.docx</span>
              <span className="font-mono tabular-nums shrink-0 ml-4">
                Flowing layout
              </span>
            </div>

            {blocks.map((block) => {
              const isSelected = selectedBlockId === block.id;
              const isHovered = hoveredBlockId === block.id;
              const isDimmed =
                Boolean(highlightedFontId) &&
                block.fontId !== highlightedFontId;

              const appliedFont =
                exportOptions.fontStrategy === 'detected'
                  ? block.detectedFont
                  : block.wordFont;
              const category = fontCategoryById.get(block.fontId);
              const fontFamily = getCssFontStack(
                appliedFont,
                block.googleFont,
                category
              );

              const computedFontSizePx = Math.round(block.fontSizePt * 1.25);

              const typographyStyle: React.CSSProperties = {
                fontFamily,
                fontSize: `${computedFontSizePx}px`,
                fontWeight: block.bold ? 700 : 400,
                fontStyle: block.italic ? 'italic' : 'normal',
                textDecoration: block.underline ? 'underline' : 'none',
                textTransform: block.allCaps ? 'uppercase' : 'none',
                color: block.colorHex,
                textAlign: block.alignment,
                lineHeight: block.lineHeight || 1.45,
                letterSpacing: block.letterSpacingPt
                  ? `${block.letterSpacingPt * 1.25}px`
                  : undefined,
              };

              return (
                <div
                  key={block.id}
                  onClick={() => onSelectBlock(block.id)}
                  onMouseEnter={() => onHoverBlock(block.id)}
                  onMouseLeave={() => onHoverBlock(null)}
                  style={{
                    marginBottom: `${Math.max(4, Math.round(block.spacingAfterPt * 1.25))}px`,
                    backgroundColor: block.backgroundColorHex || undefined,
                  }}
                  className={`relative rounded px-2 py-1 -mx-2 transition-colors ${
                    isSelected
                      ? 'ring-1 ring-blue-600 bg-blue-50/35'
                      : isHovered
                        ? 'ring-1 ring-slate-300 bg-slate-50/70'
                        : 'hover:bg-slate-50/60'
                  } ${isDimmed ? 'opacity-30' : 'opacity-100'} ${
                    block.role === 'quote' ? 'pl-7 pr-5' : ''
                  }`}
                >
                  {(isSelected || isHovered) && (
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-blue-700 font-mono tabular-nums select-none">
                      <span>{appliedFont}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{block.fontSizePt}pt</span>
                    </div>
                  )}

                  {isSelected ? (
                    <AutoResizeTextarea
                      value={block.text}
                      onChange={(nextText) =>
                        onUpdateBlock(block.id, {
                          text: nextText,
                          spans: undefined,
                        })
                      }
                      style={typographyStyle}
                      className="w-full bg-transparent resize-none focus:outline-none overflow-hidden"
                    />
                  ) : (
                    <div
                      style={typographyStyle}
                      className="w-full whitespace-pre-wrap break-words cursor-text"
                    >
                      {block.role === 'list_item' && (
                        <span aria-hidden="true">&bull; </span>
                      )}
                      {block.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
