export interface DefectBox {
  class_id: number;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InspectionResult {
  id: string;
  image_name: string;
  timestamp: string;
  defects: DefectBox[];
  defect_classes: string;
  defect_summary: string;
  total_defects: number;
  has_annotated_image: boolean;
}

export interface BatchSummary {
  total: number;
  defective: number;
  clean: number;
  skipped: number;
  skipped_files: { name: string; reason: string }[];
}

export interface HistoryResponse {
  items: InspectionResult[];
  total: number;
}

export type SSEEvent =
  | { type: "result"; index: number; total: number; result: InspectionResult }
  | { type: "skip"; index: number; total: number; name: string; reason: string }
  | { type: "done"; total: number; defective: number; clean: number; skipped: number; skipped_files: { name: string; reason: string }[] };

export const DEFECT_CLASSES: Record<number, string> = {
  0: "Lump defect",
  1: "Spatter defect",
  2: "Pin hole defect",
  3: "Chips & Burr",
  4: "Undercut defect",
  5: "Welding protrusion",
};

export const DEFECT_COLORS: Record<string, string> = {
  "Lump defect": "#008CFF",
  "Spatter defect": "#FFB45A",
  "Pin hole defect": "#78C8A0",
  "Chips & Burr": "#B48CC8",
  "Undercut defect": "#00E6FF",
  "Welding protrusion": "#5A5AFF",
};
