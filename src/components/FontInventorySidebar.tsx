import { useRef } from 'react';
import { RefreshCw, Upload, X } from 'lucide-react';
import type { DetectedFont } from '../types/typography.ts';
import {
  WORD_FONT_CATALOG,
  getCssFontStack,
} from '../utils/fontCatalog.ts';

interface FontInventorySidebarProps {
  imageSrc: string;
  sourceFileName: string;
  isAnalyzing: boolean;
  detectedFonts: DetectedFont[];
  highlightedFontId: string | null;
  fontStrategy: 'detected' | 'word-safe';
  onHighlightFont: (fontId: string | null) => void;
  onRemapFont: (fontId: string, newWordFont: string) => void;
  onReplacePhoto: (file: File) => void;
  onReanalyze: () => void;
  onChangeFontStrategy: (strategy: 'detected' | 'word-safe') => void;
}

export function FontInventorySidebar({
  imageSrc,
  sourceFileName,
  isAnalyzing,
  detectedFonts,
  highlightedFontId,
  fontStrategy,
  onHighlightFont,
  onRemapFont,
  onReplacePhoto,
  onReanalyze,
  onChangeFontStrategy,
}: FontInventorySidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <aside className="w-full lg:w-[300px] xl:w-[316px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
      {/* Uploaded source photo header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-14 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
            <img
              src={imageSrc}
              alt={sourceFileName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold text-slate-900 truncate"
              title={sourceFileName}
            >
              {sourceFileName}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Replace
              </button>
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={onReanalyze}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 disabled:opacity-40 font-medium cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`}
                />
                Re-scan
              </button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onReplacePhoto(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Font mode segmented control */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">
            Word font mode
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => onChangeFontStrategy('detected')}
            className={`px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              fontStrategy === 'detected'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Detected exact
          </button>
          <button
            type="button"
            onClick={() => onChangeFontStrategy('word-safe')}
            className={`px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              fontStrategy === 'word-safe'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Word-safe map
          </button>
        </div>
      </div>

      {/* Detected Fonts List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-900">
            Detected fonts
            {!isAnalyzing && (
              <span className="ml-1.5 font-mono font-normal text-slate-500 tabular-nums">
                ({detectedFonts.length})
              </span>
            )}
          </h2>
          {highlightedFontId && (
            <button
              type="button"
              onClick={() => onHighlightFont(null)}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium cursor-pointer"
            >
              <X className="w-3 h-3" />
              Clear filter
            </button>
          )}
        </div>

        {isAnalyzing ? (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4 space-y-2.5 animate-pulse">
                <div className="h-5 w-36 bg-slate-200 rounded" />
                <div className="h-3 w-44 bg-slate-100 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-8 w-full bg-slate-100 rounded mt-2" />
              </div>
            ))}
          </div>
        ) : detectedFonts.length === 0 ? (
          <div className="p-5 text-xs text-slate-500 leading-relaxed">
            No distinct fonts were identified in this image. Try uploading a
            sharper photo of typed text.
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {detectedFonts.map((font) => {
              const isHighlighted = highlightedFontId === font.id;
              const previewStack = getCssFontStack(
                fontStrategy === 'detected' ? font.detectedName : font.wordFont,
                font.googleFont,
                font.category
              );

              return (
                <div
                  key={font.id}
                  className={`p-4 transition-colors ${
                    isHighlighted ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onHighlightFont(isHighlighted ? null : font.id)
                    }
                    className="w-full text-left cursor-pointer focus-visible:outline-none"
                  >
                    <p
                      className="text-base font-semibold text-slate-900 leading-snug"
                      style={{ fontFamily: previewStack }}
                    >
                      {font.detectedName}
                    </p>
                    <div className="mt-1 flex items-center flex-wrap gap-x-1.5 text-xs text-slate-500 tabular-nums">
                      <span>{font.category}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="font-mono">{font.confidence}% match</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>
                        {font.usageCount}{' '}
                        {font.usageCount === 1 ? 'block' : 'blocks'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      {font.characteristics}
                    </p>
                  </button>

                  {/* Word target mapping dropdown */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Export font in Word (.docx)
                    </label>
                    <select
                      value={font.wordFont}
                      onChange={(e) => onRemapFont(font.id, e.target.value)}
                      className="w-full h-8 px-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {!WORD_FONT_CATALOG.some(
                        (opt) => opt.name === font.wordFont
                      ) && (
                        <option value={font.wordFont}>{font.wordFont}</option>
                      )}
                      {!WORD_FONT_CATALOG.some(
                        (opt) => opt.name === font.detectedName
                      ) &&
                        font.detectedName !== font.wordFont && (
                          <option value={font.detectedName}>
                            {font.detectedName} (Detected)
                          </option>
                        )}
                      {WORD_FONT_CATALOG.map((opt) => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name} — {opt.category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
