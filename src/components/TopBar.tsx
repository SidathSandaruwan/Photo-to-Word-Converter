import { Download, Loader2 } from 'lucide-react';

export type WorkspaceTab = 'studio' | 'fonts' | 'export';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  hasDocument: boolean;
  isExporting: boolean;
  onExportDocx: () => void;
  onResetToUpload: () => void;
}

export function TopBar({
  activeTab,
  onSelectTab,
  hasDocument,
  isExporting,
  onExportDocx,
  onResetToUpload,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element brand wordmark */}
      <button
        type="button"
        onClick={onResetToUpload}
        className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        TypePress
      </button>

      {/* Zone 2: Clean single-line text navigation */}
      <nav
        aria-label="Workspace views"
        className="flex items-center gap-6 text-sm font-medium"
      >
        <button
          type="button"
          onClick={() => onSelectTab('studio')}
          className={`relative py-4 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:text-blue-700 ${
            activeTab === 'studio'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Studio
          {activeTab === 'studio' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('fonts')}
          className={`relative py-4 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:text-blue-700 ${
            activeTab === 'fonts'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Detected Fonts
          {activeTab === 'fonts' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('export')}
          className={`relative py-4 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:text-blue-700 ${
            activeTab === 'export'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Export Settings
          {activeTab === 'export' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700" />
          )}
        </button>
      </nav>

      {/* Zone 3: Single primary CTA */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          disabled={!hasDocument || isExporting}
          onClick={onExportDocx}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Building Word file
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Export Word (.docx)
            </>
          )}
        </button>
      </div>
    </header>
  );
}
