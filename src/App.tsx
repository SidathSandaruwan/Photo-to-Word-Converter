import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { TopBar, type WorkspaceTab } from './components/TopBar.tsx';
import { UploadDropzone } from './components/UploadDropzone.tsx';
import { FontInventorySidebar } from './components/FontInventorySidebar.tsx';
import { PhotoInspector } from './components/PhotoInspector.tsx';
import { WordDocumentCanvas } from './components/WordDocumentCanvas.tsx';
import { FontDetailView } from './components/FontDetailView.tsx';
import { ExportSettingsView } from './components/ExportSettingsView.tsx';
import type {
  AnalysisResult,
  ExportOptions,
  TextBlock,
} from './types/typography.ts';
import {
  imageUrlToDataUrl,
  loadGoogleFonts,
  resolveGoogleFontForName,
} from './utils/fontCatalog.ts';
import {
  getImageDimensions,
  prepareVisualCrops,
} from './utils/imageCrop.ts';

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  filename: 'typepress-document',
  layoutMode: 'exact',
  pageSize: 'match-photo',
  fontStrategy: 'detected',
  includeBackground: true,
  includeVisualElements: true,
  includeFontReport: false,
  marginInches: 1.0,
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image file.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [pageCropDataUrl, setPageCropDataUrl] = useState<string | undefined>(
    undefined
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [highlightedFontId, setHighlightedFontId] = useState<string | null>(
    null
  );
  const [exportOptions, setExportOptions] = useState<ExportOptions>(
    DEFAULT_EXPORT_OPTIONS
  );

  // Dynamically load Google Fonts matching detected/mapped fonts for live paper preview
  useEffect(() => {
    if (!analysis) return;
    const namesToLoad: string[] = [];
    for (const font of analysis.detectedFonts) {
      namesToLoad.push(font.googleFont, font.detectedName, font.wordFont);
    }
    for (const block of analysis.blocks) {
      namesToLoad.push(block.googleFont, block.detectedFont, block.wordFont);
      if (block.spans) {
        for (const span of block.spans) {
          if (span.fontFamily) namesToLoad.push(span.fontFamily);
        }
      }
    }
    loadGoogleFonts(namesToLoad);
  }, [analysis]);

  // Auto-dismiss confirmation toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const runAnalysis = useCallback(
    async (dataUrl: string, mimeType: string) => {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSelectedBlockId(null);
      setHighlightedFontId(null);
      setPageCropDataUrl(undefined);

      try {
        const dims = await getImageDimensions(dataUrl).catch(() => ({
          width: undefined,
          height: undefined,
        }));

        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType,
            imageWidth: dims.width,
            imageHeight: dims.height,
          }),
        });

        const payload = (await response.json()) as AnalysisResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error || 'Could not analyze the uploaded photo.'
          );
        }

        // Crop embedded photos/graphics and page trace backdrop directly from source photo
        const cropped = await prepareVisualCrops(
          dataUrl,
          payload.pageBounds || [0, 0, 1000, 1000],
          payload.visualElements || []
        );

        setPageCropDataUrl(cropped.pageCropDataUrl);
        setAnalysis({
          ...payload,
          visualElements: cropped.visualElements,
        });
        setExportOptions((prev) => ({
          ...prev,
          filename: payload.suggestedFilename || 'typepress-document',
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during font detection.';
        setErrorMessage(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (file.size > 20 * 1024 * 1024) {
        setErrorMessage(
          'Image exceeds the 20 MB limit. Please choose a smaller photo.'
        );
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const mimeType = file.type || 'image/jpeg';
        setImageDataUrl(dataUrl);
        setImageMimeType(mimeType);
        setSourceFileName(file.name);
        setAnalysis(null);
        setActiveTab('studio');
        await runAnalysis(dataUrl, mimeType);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load photo.'
        );
      }
    },
    [runAnalysis]
  );

  const handleSampleSelected = useCallback(
    async (sample: {
      title: string;
      url?: string;
      dataUrl?: string;
      mimeType: string;
    }) => {
      try {
        setErrorMessage(null);
        let dataUrl = sample.dataUrl || '';
        let mimeType = sample.mimeType;

        if (!dataUrl && sample.url) {
          const loaded = await imageUrlToDataUrl(sample.url);
          dataUrl = loaded.dataUrl;
          mimeType = loaded.mimeType;
        }

        if (!dataUrl) {
          throw new Error('Sample specimen image could not be loaded.');
        }

        setImageDataUrl(dataUrl);
        setImageMimeType(mimeType);
        setSourceFileName(`${sample.title}.jpg`);
        setAnalysis(null);
        setActiveTab('studio');
        await runAnalysis(dataUrl, mimeType);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load sample photo.'
        );
      }
    },
    [runAnalysis]
  );

  const handleRemapFont = useCallback(
    (fontId: string, newWordFont: string) => {
      const nextGoogleFont = resolveGoogleFontForName(newWordFont);
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          detectedFonts: prev.detectedFonts.map((f) =>
            f.id === fontId
              ? {
                  ...f,
                  wordFont: newWordFont,
                  googleFont: nextGoogleFont || f.googleFont,
                }
              : f
          ),
          blocks: prev.blocks.map((b) =>
            b.fontId === fontId
              ? {
                  ...b,
                  wordFont: newWordFont,
                  googleFont: nextGoogleFont || b.googleFont,
                }
              : b
          ),
        };
      });
      setExportOptions((prev) => ({
        ...prev,
        fontStrategy: 'word-safe',
      }));
    },
    []
  );

  const handleUpdateBlock = useCallback(
    (blockId: string, patch: Partial<TextBlock>) => {
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === blockId ? { ...b, ...patch } : b
          ),
        };
      });
    },
    []
  );

  const handleAddBlock = useCallback(() => {
    setAnalysis((prev) => {
      const primaryFont = prev?.detectedFonts[0];
      const newBlock: TextBlock = {
        id: `block-${Date.now()}`,
        text: 'New text block',
        role: 'paragraph',
        fontId: primaryFont?.id || 'font-custom',
        detectedFont: primaryFont?.detectedName || 'Georgia',
        wordFont: primaryFont?.wordFont || 'Georgia',
        googleFont: primaryFont?.googleFont || 'Lora',
        fontSizePt: 11,
        lineCount: 1,
        lineHeight: 1.35,
        letterSpacingPt: 0,
        bold: false,
        italic: false,
        underline: false,
        allCaps: false,
        colorHex: '#1A1A1A',
        alignment: 'left',
        spacingAfterPt: 8,
        layout: {
          xPct: 12,
          yPct: 82,
          widthPct: 76,
          heightPct: 4,
        },
      };

      if (!prev) {
        return {
          documentTitle: 'Untitled Document',
          suggestedFilename: 'untitled-document',
          language: 'English',
          pageOrientation: 'portrait',
          pageBounds: [0, 0, 1000, 1000],
          pageBackgroundHex: '#FFFFFF',
          pageAspectRatio: 8.5 / 11,
          summary: 'Manual document',
          detectedFonts: [],
          visualElements: [],
          blocks: [newBlock],
        };
      }

      setSelectedBlockId(newBlock.id);
      return {
        ...prev,
        blocks: [...prev.blocks, newBlock],
      };
    });
  }, []);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.filter((b) => b.id !== blockId),
      };
    });
    setSelectedBlockId((current) => (current === blockId ? null : current));
  }, []);

  const handleExportDocx = useCallback(async () => {
    if (!analysis || analysis.blocks.length === 0) return;

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: analysis.documentTitle,
          blocks: analysis.blocks,
          detectedFonts: analysis.detectedFonts,
          visualElements: analysis.visualElements,
          options: exportOptions,
          pageBackgroundHex: analysis.pageBackgroundHex,
          pageOrientation: analysis.pageOrientation,
          pageAspectRatio: analysis.pageAspectRatio,
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errBody.error || 'Failed to build the Microsoft Word file.'
        );
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const cleanName = (exportOptions.filename || 'typepress-document')
        .replace(/\.docx$/i, '')
        .trim();
      anchor.href = downloadUrl;
      anchor.download = `${cleanName || 'typepress-document'}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);

      setToastMessage(`Saved ${cleanName || 'typepress-document'}.docx`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not generate the Word document.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [analysis, exportOptions]);

  const handleResetToUpload = useCallback(() => {
    setImageDataUrl(null);
    setPageCropDataUrl(undefined);
    setAnalysis(null);
    setErrorMessage(null);
    setSelectedBlockId(null);
    setHighlightedFontId(null);
    setActiveTab('studio');
  }, []);

  const hasExportableDocument = Boolean(
    analysis && analysis.blocks.length > 0 && !isAnalyzing
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasDocument={hasExportableDocument}
        isExporting={isExporting}
        onExportDocx={handleExportDocx}
        onResetToUpload={handleResetToUpload}
      />

      {/* Global inline error banner inside workspace */}
      {errorMessage && imageDataUrl && (
        <div
          role="alert"
          className="px-6 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-4 text-xs text-red-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main view router */}
      {activeTab === 'fonts' ? (
        <FontDetailView
          detectedFonts={analysis?.detectedFonts ?? []}
          fontStrategy={exportOptions.fontStrategy}
          onRemapFont={handleRemapFont}
          onInspectInStudio={(fontId) => {
            setHighlightedFontId(fontId);
            setActiveTab('studio');
          }}
          onReturnToUpload={() => setActiveTab('studio')}
        />
      ) : activeTab === 'export' ? (
        <ExportSettingsView
          options={exportOptions}
          detectedFonts={analysis?.detectedFonts ?? []}
          blockCount={analysis?.blocks.length ?? 0}
          visualElementCount={analysis?.visualElements.length ?? 0}
          pageBackgroundHex={analysis?.pageBackgroundHex || '#FFFFFF'}
          hasDocument={hasExportableDocument}
          isExporting={isExporting}
          onChangeOptions={(patch) =>
            setExportOptions((prev) => ({ ...prev, ...patch }))
          }
          onExportDocx={handleExportDocx}
          onReturnToUpload={() => setActiveTab('studio')}
        />
      ) : !imageDataUrl ? (
        <UploadDropzone
          onFileSelected={handleFileSelected}
          onSampleSelected={handleSampleSelected}
          errorMessage={errorMessage}
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
          <FontInventorySidebar
            imageSrc={imageDataUrl}
            sourceFileName={sourceFileName}
            isAnalyzing={isAnalyzing}
            detectedFonts={analysis?.detectedFonts ?? []}
            highlightedFontId={highlightedFontId}
            fontStrategy={exportOptions.fontStrategy}
            onHighlightFont={setHighlightedFontId}
            onRemapFont={handleRemapFont}
            onReplacePhoto={handleFileSelected}
            onReanalyze={() => runAnalysis(imageDataUrl, imageMimeType)}
            onChangeFontStrategy={(strategy) =>
              setExportOptions((prev) => ({ ...prev, fontStrategy: strategy }))
            }
          />

          <div className="flex-1 flex flex-col xl:flex-row min-w-0">
            <PhotoInspector
              imageSrc={imageDataUrl}
              sourceFileName={sourceFileName}
              blocks={analysis?.blocks ?? []}
              visualElements={analysis?.visualElements ?? []}
              pageBounds={analysis?.pageBounds}
              isAnalyzing={isAnalyzing}
              selectedBlockId={selectedBlockId}
              hoveredBlockId={hoveredBlockId}
              highlightedFontId={highlightedFontId}
              onSelectBlock={setSelectedBlockId}
              onHoverBlock={setHoveredBlockId}
            />

            <WordDocumentCanvas
              documentTitle={
                exportOptions.filename ||
                analysis?.documentTitle ||
                'typepress-document'
              }
              blocks={analysis?.blocks ?? []}
              visualElements={analysis?.visualElements ?? []}
              detectedFonts={analysis?.detectedFonts ?? []}
              pageBackgroundHex={analysis?.pageBackgroundHex || '#FFFFFF'}
              pageAspectRatio={analysis?.pageAspectRatio || 8.5 / 11}
              pageOrientation={analysis?.pageOrientation || 'portrait'}
              pageCropDataUrl={pageCropDataUrl}
              exportOptions={exportOptions}
              isAnalyzing={isAnalyzing}
              selectedBlockId={selectedBlockId}
              hoveredBlockId={hoveredBlockId}
              highlightedFontId={highlightedFontId}
              onSelectBlock={setSelectedBlockId}
              onHoverBlock={setHoveredBlockId}
              onUpdateBlock={handleUpdateBlock}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onChangeLayoutMode={(mode) =>
                setExportOptions((prev) => ({ ...prev, layoutMode: mode }))
              }
            />
          </div>
        </div>
      )}

      {/* Subtle export confirmation toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-md shadow-lg flex items-center gap-2 text-xs font-medium"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
