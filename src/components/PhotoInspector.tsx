import { useState } from 'react';
import { Eye, EyeOff, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { TextBlock, VisualElement } from '../types/typography.ts';

interface PhotoInspectorProps {
  imageSrc: string;
  sourceFileName: string;
  blocks: TextBlock[];
  visualElements: VisualElement[];
  pageBounds?: [number, number, number, number];
  isAnalyzing: boolean;
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  highlightedFontId: string | null;
  onSelectBlock: (blockId: string) => void;
  onHoverBlock: (blockId: string | null) => void;
}

export function PhotoInspector({
  imageSrc,
  sourceFileName,
  blocks,
  visualElements,
  pageBounds,
  isAnalyzing,
  selectedBlockId,
  hoveredBlockId,
  highlightedFontId,
  onSelectBlock,
  onHoverBlock,
}: PhotoInspectorProps) {
  const [showOverlays, setShowOverlays] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  const blocksWithBoxes = blocks.filter((b) => Array.isArray(b.box2d));
  const hasCroppedPageBounds =
    Array.isArray(pageBounds) &&
    (pageBounds[0] > 15 ||
      pageBounds[1] > 15 ||
      pageBounds[2] < 985 ||
      pageBounds[3] < 985);

  return (
    <section className="flex flex-col min-w-0 bg-[#EEF1F5] border-b xl:border-b-0 xl:border-r border-slate-200 xl:w-[44%] xl:max-w-[520px] shrink-0">
      {/* Pane toolbar */}
      <div className="h-11 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-slate-900 whitespace-nowrap">
            Source photo
          </span>
          {!isAnalyzing && blocks.length > 0 && (
            <>
              <span className="text-slate-300" aria-hidden="true">
                &middot;
              </span>
              <span className="text-slate-500 font-mono tabular-nums whitespace-nowrap">
                {blocks.length} text
                {visualElements.length > 0
                  ? ` · ${visualElements.length} graphic`
                  : ''}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowOverlays((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            {showOverlays ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            {showOverlays ? 'Hide boxes' : 'Show boxes'}
          </button>

          <button
            type="button"
            onClick={() => setZoomed((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            {zoomed ? (
              <ZoomOut className="w-3.5 h-3.5" />
            ) : (
              <ZoomIn className="w-3.5 h-3.5" />
            )}
            {zoomed ? 'Fit' : 'Zoom'}
          </button>
        </div>
      </div>

      {/* Photo canvas */}
      <div className="flex-1 overflow-auto p-5 flex items-start justify-center">
        <div
          className={`relative inline-block bg-white border border-slate-200 rounded-md overflow-hidden transition-all ${
            zoomed ? 'w-[140%] max-w-none' : 'w-full max-w-[440px]'
          }`}
        >
          <img
            src={imageSrc}
            alt={`Uploaded document photo: ${sourceFileName}`}
            referrerPolicy="no-referrer"
            className="block w-full h-auto select-none"
          />

          {/* Detected page crop boundary */}
          {!isAnalyzing && showOverlays && hasCroppedPageBounds && pageBounds && (
            <div
              aria-hidden="true"
              style={{
                top: `${pageBounds[0] / 10}%`,
                left: `${pageBounds[1] / 10}%`,
                height: `${(pageBounds[2] - pageBounds[0]) / 10}%`,
                width: `${(pageBounds[3] - pageBounds[1]) / 10}%`,
              }}
              className="absolute border border-dashed border-slate-700/70 pointer-events-none"
            />
          )}

          {/* Non-text visual element outlines */}
          {!isAnalyzing &&
            showOverlays &&
            visualElements.map((el) => {
              const [ymin, xmin, ymax, xmax] = el.box2d;
              return (
                <div
                  key={el.id}
                  title={el.label || el.kind}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    height: `${Math.max(0.5, (ymax - ymin) / 10)}%`,
                    width: `${Math.max(0.5, (xmax - xmin) / 10)}%`,
                  }}
                  className="absolute border border-emerald-600/60 bg-emerald-500/5 pointer-events-none"
                />
              );
            })}

          {/* Interactive bounding-box overlays for text blocks */}
          {!isAnalyzing &&
            showOverlays &&
            blocksWithBoxes.map((block) => {
              const [ymin, xmin, ymax, xmax] = block.box2d!;
              const isSelected = selectedBlockId === block.id;
              const isHovered = hoveredBlockId === block.id;
              const matchesFont =
                !highlightedFontId || block.fontId === highlightedFontId;

              return (
                <button
                  key={block.id}
                  type="button"
                  title={`${block.detectedFont} · ${block.fontSizePt}pt · ${block.colorHex}`}
                  onClick={() => onSelectBlock(block.id)}
                  onMouseEnter={() => onHoverBlock(block.id)}
                  onMouseLeave={() => onHoverBlock(null)}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    height: `${Math.max(1.2, (ymax - ymin) / 10)}%`,
                    width: `${Math.max(1.2, (xmax - xmin) / 10)}%`,
                  }}
                  className={`absolute transition-colors cursor-pointer focus-visible:outline-none ${
                    isSelected
                      ? 'border-2 border-blue-700 bg-blue-600/14 z-20'
                      : isHovered
                        ? 'border border-blue-600 bg-blue-500/10 z-10'
                        : highlightedFontId && matchesFont
                          ? 'border-2 border-blue-600 bg-blue-500/10 z-10'
                          : matchesFont
                            ? 'border border-blue-500/45 hover:border-blue-600 hover:bg-blue-500/8'
                            : 'border border-slate-400/20 bg-slate-900/10 opacity-40'
                  }`}
                />
              );
            })}

          {/* Analyzing overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-900">
                    Mapping exact layout, fonts, and colors
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Measuring positions, point sizes, rules, and embedded images
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
