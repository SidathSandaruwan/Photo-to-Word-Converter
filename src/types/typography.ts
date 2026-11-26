export type FontCategory =
  | 'Serif'
  | 'Sans-Serif'
  | 'Monospace'
  | 'Display'
  | 'Script';

export type TextRole =
  | 'title'
  | 'heading1'
  | 'heading2'
  | 'paragraph'
  | 'quote'
  | 'list_item'
  | 'caption';

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export interface LayoutBox {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  colorHex?: string;
  fontFamily?: string;
  fontSizePt?: number;
}

export interface VisualElement {
  id: string;
  kind: 'image' | 'rectangle' | 'line';
  label?: string;
  box2d: [number, number, number, number];
  layout: LayoutBox;
  fillColorHex?: string;
  borderColorHex?: string;
  borderWidthPt?: number;
  croppedDataUrl?: string;
}

export interface DetectedFont {
  id: string;
  detectedName: string;
  wordFont: string;
  googleFont: string;
  category: FontCategory;
  confidence: number;
  characteristics: string;
  sampleText: string;
  usageCount: number;
}

export interface TextBlock {
  id: string;
  text: string;
  role: TextRole;
  fontId: string;
  detectedFont: string;
  wordFont: string;
  googleFont: string;
  fontSizePt: number;
  lineCount: number;
  lineHeight: number;
  letterSpacingPt: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  allCaps: boolean;
  colorHex: string;
  backgroundColorHex?: string;
  borderColorHex?: string;
  borderWidthPt?: number;
  alignment: TextAlignment;
  spacingAfterPt: number;
  box2d?: [number, number, number, number];
  layout: LayoutBox;
  spans?: TextSpan[];
}

export interface AnalysisResult {
  documentTitle: string;
  suggestedFilename: string;
  language: string;
  pageOrientation: 'portrait' | 'landscape';
  pageBounds: [number, number, number, number];
  pageBackgroundHex: string;
  pageAspectRatio: number;
  summary: string;
  detectedFonts: DetectedFont[];
  blocks: TextBlock[];
  visualElements: VisualElement[];
}

export interface ExportOptions {
  filename: string;
  layoutMode: 'exact' | 'flowing';
  pageSize: 'match-photo' | 'letter' | 'a4';
  fontStrategy: 'detected' | 'word-safe';
  includeBackground: boolean;
  includeVisualElements: boolean;
  includeFontReport: boolean;
  marginInches: number;
}
