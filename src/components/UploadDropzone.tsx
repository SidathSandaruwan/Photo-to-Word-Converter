import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Upload } from 'lucide-react';
import { createMultiFontSpecimenDataUrl } from '../utils/fontCatalog.ts';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  onSampleSelected: (sample: {
    title: string;
    url?: string;
    dataUrl?: string;
    mimeType: string;
  }) => void;
  errorMessage?: string | null;
}

const EDITORIAL_SAMPLE_URL =
  '/src/assets/images/sample_editorial_page_1795660904295.jpg';

export function UploadDropzone({
  onFileSelected,
  onSampleSelected,
  errorMessage,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editorialImgFailed, setEditorialImgFailed] = useState(false);

  const multiFontPreview = useMemo(() => {
    if (typeof document === 'undefined') return '';
    return createMultiFontSpecimenDataUrl();
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            onFileSelected(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileSelected]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelected(file);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Studio intro header */}
      <section className="mb-8">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 max-w-2xl"
          style={{ textWrap: 'balance' }}
        >
          Detect fonts from any photo and build a matching Word file
        </h1>
        <p className="mt-3 text-base text-slate-600 max-w-2xl leading-relaxed">
          Upload a photograph of a printed page, poster, book spread, or typed
          document. TypePress identifies the typefaces, sizes, and layout
          hierarchy, then generates an editable Microsoft Word (.docx) document.
        </p>

        {/* Clean 3-step editorial rail (unboxed, hairline divider) */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-semibold text-slate-900">01. Upload photo</p>
            <p className="mt-1 text-slate-500">
              Drop a JPG, PNG, or WEBP photograph containing typed words.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              02. Detect fonts &amp; layout
            </p>
            <p className="mt-1 text-slate-500">
              Inspect every detected typeface, size, alignment, and text block.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              03. Export Word (.docx)
            </p>
            <p className="mt-1 text-slate-500">
              Edit text or remap fonts, then download a formatted Word document.
            </p>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {/* Primary dominant focal anchor: Photo dropzone */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-white border rounded-xl p-10 sm:p-14 text-center transition-colors ${
          isDragging
            ? 'border-blue-600 bg-blue-50/40'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = '';
          }}
        />

        <div className="mx-auto w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
          <Upload className="w-5 h-5" />
        </div>

        <h2 className="mt-5 text-lg font-semibold text-slate-900">
          Drop a photo of typed text here
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Supports PNG, JPG, and WEBP up to 20 MB · Or paste directly from your
          clipboard
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Choose Photo
          </button>
        </div>
      </section>

      {/* Sample Specimens for immediate testing */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Or test with a sample specimen
          </h2>
          <span className="text-xs text-slate-500">
            Click a specimen to run live font detection
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sample 1: Generated studio photograph */}
          <button
            type="button"
            onClick={() =>
              onSampleSelected({
                title: 'Editorial Magazine Page',
                url: EDITORIAL_SAMPLE_URL,
                mimeType: 'image/jpeg',
              })
            }
            className="group text-left bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-blue-600 transition-colors flex items-stretch cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="w-32 shrink-0 bg-slate-100 border-r border-slate-200 overflow-hidden relative">
              {!editorialImgFailed ? (
                <img
                  src={EDITORIAL_SAMPLE_URL}
                  alt="Printed literary magazine page titled The Architecture of Quiet Spaces"
                  referrerPolicy="no-referrer"
                  onError={() => setEditorialImgFailed(true)}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between min-w-0">
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Editorial Magazine Page
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Classic Serif · Italic Deck · Sans Caption
                </p>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  Photograph of a printed book spread with display serif title,
                  body paragraphs, and figure caption.
                </p>
              </div>
              <span className="mt-4 text-xs font-semibold text-blue-700">
                Analyze specimen &rarr;
              </span>
            </div>
          </button>

          {/* Sample 2: Multi-font technical brief */}
          <button
            type="button"
            onClick={() =>
              onSampleSelected({
                title: 'Multi-Font Typography Brief',
                dataUrl: multiFontPreview,
                mimeType: 'image/jpeg',
              })
            }
            className="group text-left bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-blue-600 transition-colors flex items-stretch cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="w-32 shrink-0 bg-slate-100 border-r border-slate-200 overflow-hidden relative">
              {multiFontPreview ? (
                <img
                  src={multiFontPreview}
                  alt="Printed specification sheet combining Georgia serif, Arial sans-serif, and Courier New monospace"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between min-w-0">
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Multi-Font Specification Sheet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Georgia · Arial · Courier New
                </p>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  Three distinct font families on one page to test multi-font
                  detection and Word export fidelity.
                </p>
              </div>
              <span className="mt-4 text-xs font-semibold text-blue-700">
                Analyze specimen &rarr;
              </span>
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
