import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { DetectedFont, FontCategory } from '../types/typography.ts';
import { WORD_FONT_CATALOG, getCssFontStack } from '../utils/fontCatalog.ts';

interface FontDetailViewProps {
  detectedFonts: DetectedFont[];
  fontStrategy: 'detected' | 'word-safe';
  onRemapFont: (fontId: string, newWordFont: string) => void;
  onInspectInStudio: (fontId: string) => void;
  onReturnToUpload: () => void;
}

const CATEGORY_FILTERS: Array<'All' | FontCategory> = [
  'All',
  'Serif',
  'Sans-Serif',
  'Monospace',
  'Display',
  'Script',
];

export function FontDetailView({
  detectedFonts,
  fontStrategy,
  onRemapFont,
  onInspectInStudio,
  onReturnToUpload,
}: FontDetailViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | FontCategory>(
    'All'
  );

  const filteredFonts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return detectedFonts.filter((font) => {
      if (categoryFilter !== 'All' && font.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        font.detectedName.toLowerCase().includes(q) ||
        font.wordFont.toLowerCase().includes(q) ||
        font.characteristics.toLowerCase().includes(q) ||
        font.sampleText.toLowerCase().includes(q)
      );
    });
  }, [detectedFonts, searchQuery, categoryFilter]);

  if (detectedFonts.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          No detected fonts yet
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Upload a photograph containing typed words first. Every detected
          typeface, confidence score, and Word font mapping will appear here.
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
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Detected font inventory
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Inspect every typeface identified in your photo and customize the
            exact font written to your Word (.docx) file.
          </p>
        </div>

        {/* Filter and search controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fonts or traits..."
              className="h-9 pl-8 pr-3 w-52 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {CATEGORY_FILTERS.filter(
              (cat) =>
                cat === 'All' || detectedFonts.some((f) => f.category === cat)
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* High-density specimen table */}
      <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Detected typeface &amp; specimen</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 text-right">Match</th>
                <th className="py-3 px-4 text-right">Blocks</th>
                <th className="py-3 px-4">Word (.docx) font</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-sm">
              {filteredFonts.map((font) => {
                const specimenStack = getCssFontStack(
                  fontStrategy === 'detected'
                    ? font.detectedName
                    : font.wordFont,
                  font.googleFont,
                  font.category
                );

                return (
                  <tr
                    key={font.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-4 px-4 max-w-md">
                      <p
                        className="text-lg font-semibold text-slate-900 leading-snug"
                        style={{ fontFamily: specimenStack }}
                      >
                        {font.detectedName}
                      </p>
                      <p
                        className="mt-1 text-sm text-slate-700 truncate"
                        style={{ fontFamily: specimenStack }}
                      >
                        &ldquo;{font.sampleText}&rdquo;
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {font.characteristics}
                      </p>
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {font.category}
                    </td>

                    <td className="py-4 px-4 text-right font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                      {font.confidence}%
                    </td>

                    <td className="py-4 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {font.usageCount}
                    </td>

                    <td className="py-4 px-4">
                      <select
                        value={font.wordFont}
                        onChange={(e) => onRemapFont(font.id, e.target.value)}
                        className="h-8 px-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600 cursor-pointer"
                      >
                        {!WORD_FONT_CATALOG.some(
                          (opt) => opt.name === font.wordFont
                        ) && (
                          <option value={font.wordFont}>{font.wordFont}</option>
                        )}
                        {WORD_FONT_CATALOG.map((opt) => (
                          <option key={opt.name} value={opt.name}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectInStudio(font.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                      >
                        Highlight in studio
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredFonts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 px-4 text-center text-xs text-slate-500"
                  >
                    No detected fonts match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
