import { Download, Loader2 } from 'lucide-react';
import type { DetectedFont, ExportOptions } from '../types/typography.ts';

interface ExportSettingsViewProps {
  options: ExportOptions;
  detectedFonts: DetectedFont[];
  blockCount: number;
  visualElementCount: number;
  pageBackgroundHex: string;
  hasDocument: boolean;
  isExporting: boolean;
  onChangeOptions: (patch: Partial<ExportOptions>) => void;
  onExportDocx: () => void;
  onReturnToUpload: () => void;
}

export function ExportSettingsView({
  options,
  detectedFonts,
  blockCount,
  visualElementCount,
  pageBackgroundHex,
  hasDocument,
  isExporting,
  onChangeOptions,
  onExportDocx,
  onReturnToUpload,
}: ExportSettingsViewProps) {
  if (!hasDocument) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          No document ready for export
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Upload and analyze a photo first to configure exact layout fidelity,
          page geometry, and Word (.docx) export options.
        </p>
        <button
          type="button"
          onClick={onReturnToUpload}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors cursor-pointer"
        >
          Upload Photo
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Word (.docx) export settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Control how positions, fonts, colors, backgrounds, and graphics are
          written into the generated Microsoft Word document.
        </p>
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {/* Filename */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <label
              htmlFor="export-filename"
              className="text-sm font-semibold text-slate-900"
            >
              Output filename
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Saved directly as a standard Microsoft Word file.
            </p>
          </div>
          <div className="sm:col-span-2 flex items-center">
            <input
              id="export-filename"
              type="text"
              value={options.filename}
              onChange={(e) => onChangeOptions({ filename: e.target.value })}
              className="flex-1 h-9 px-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-l-md focus:outline-none focus:border-blue-600"
            />
            <span className="h-9 px-3 inline-flex items-center text-xs font-mono text-slate-500 bg-slate-50 border border-l-0 border-slate-200 rounded-r-md">
              .docx
            </span>
          </div>
        </div>

        {/* Layout fidelity mode */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Layout fidelity
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Exact replica locks every text box, embedded photo, divider rule,
              and color to its exact coordinates from the original picture.
            </p>
          </div>
          <div className="sm:col-span-2 space-y-2.5">
            <label className="flex items-start gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="layoutMode"
                checked={options.layoutMode === 'exact'}
                onChange={() => onChangeOptions({ layoutMode: 'exact' })}
                className="mt-0.5 accent-blue-700"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Exact Replica (1:1 places, sizes, colors &amp; graphics)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses native Word positioned text boxes, floating cropped
                  images, vector rules, and page background color to match the
                  original photo.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="layoutMode"
                checked={options.layoutMode === 'flowing'}
                onChange={() => onChangeOptions({ layoutMode: 'flowing' })}
                className="mt-0.5 accent-blue-700"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Flowing Document (Reflowable paragraphs)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Outputs standard stacked Word paragraphs with detected fonts,
                  sizes, and colors for heavy text editing.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Font strategy */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Font naming strategy
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose whether Word receives the exact detected typeface name or a
              universally installed equivalent.
            </p>
          </div>
          <div className="sm:col-span-2 space-y-2.5">
            <label className="flex items-start gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="fontStrategy"
                checked={options.fontStrategy === 'detected'}
                onChange={() => onChangeOptions({ fontStrategy: 'detected' })}
                className="mt-0.5 accent-blue-700"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Exact detected font names
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Writes the exact typeface detected from the photo into the
                  Word XML.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="fontStrategy"
                checked={options.fontStrategy === 'word-safe'}
                onChange={() => onChangeOptions({ fontStrategy: 'word-safe' })}
                className="mt-0.5 accent-blue-700"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Word-safe system equivalents
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses your mapped standard Word fonts so the file opens
                  consistently on any Windows or Mac computer.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Page Size & Exact Elements */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Page geometry &amp; assets
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Match the exact page proportions of your photo or fit to standard
              print stock.
            </p>
          </div>
          <div className="sm:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Paper size
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { value: 'match-photo', label: 'Match photo' },
                    { value: 'letter', label: 'US Letter' },
                    { value: 'a4', label: 'A4' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onChangeOptions({ pageSize: item.value })}
                    className={`py-1.5 text-xs font-medium rounded cursor-pointer transition-colors whitespace-nowrap ${
                      options.pageSize === item.value
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {options.layoutMode === 'flowing' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Page margins (Flowing mode)
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                  {[
                    { label: '0.5 in', value: 0.5 },
                    { label: '0.75 in', value: 0.75 },
                    { label: '1.0 in', value: 1.0 },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onChangeOptions({ marginInches: m.value })}
                      className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded cursor-pointer transition-colors ${
                        options.marginInches === m.value
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeBackground}
                  onChange={(e) =>
                    onChangeOptions({ includeBackground: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-700 rounded"
                />
                <span>
                  Preserve original page background color{' '}
                  <span className="font-mono text-xs text-slate-500">
                    ({pageBackgroundHex})
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeVisualElements}
                  onChange={(e) =>
                    onChangeOptions({
                      includeVisualElements: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-blue-700 rounded"
                />
                <span>
                  Include embedded photos, divider rules &amp; shaded boxes{' '}
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    ({visualElementCount} detected)
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeFontReport}
                  onChange={(e) =>
                    onChangeOptions({ includeFontReport: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-700 rounded"
                />
                <span>Append Detected Typography Report page at end</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preflight summary & export CTA */}
        <div className="p-6 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-600 tabular-nums">
            Ready to export{' '}
            <span className="font-semibold text-slate-900">
              {blockCount} blocks
            </span>
            {visualElementCount > 0 && options.includeVisualElements && (
              <>
                {' '}
                and{' '}
                <span className="font-semibold text-slate-900">
                  {visualElementCount}{' '}
                  {visualElementCount === 1 ? 'graphic' : 'graphics'}
                </span>
              </>
            )}{' '}
            in{' '}
            <span className="font-semibold text-slate-900">
              {options.layoutMode === 'exact'
                ? 'Exact Replica'
                : 'Flowing Text'}
            </span>{' '}
            mode
          </div>

          <button
            type="button"
            disabled={isExporting || blockCount === 0}
            onClick={onExportDocx}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Word file...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download {options.filename || 'document'}.docx
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
