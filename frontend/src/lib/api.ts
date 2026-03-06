import type { HistoryResponse, SSEEvent } from "./types";

const BASE = "/api";

export async function inspectImages(
  files: File[],
  confidence: number,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${BASE}/inspect?confidence=${confidence}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Inspection failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (data) {
        onEvent(JSON.parse(data));
      }
    }
  }
}

export async function fetchHistory(
  search = "",
  defectFilter = ""
): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (defectFilter && defectFilter !== "All") params.set("defect_filter", defectFilter);
  const res = await fetch(`${BASE}/history?${params}`);
  return res.json();
}

export function getAnnotatedImageUrl(imageName: string): string {
  return `${BASE}/history/${encodeURIComponent(imageName)}/image`;
}

export async function clearHistory(): Promise<void> {
  await fetch(`${BASE}/history`, { method: "DELETE" });
}

export function getExportCsvUrl(search = "", defectFilter = ""): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (defectFilter && defectFilter !== "All") params.set("defect_filter", defectFilter);
  return `${BASE}/export/csv?${params}`;
}

export function getExportZipUrl(): string {
  return `${BASE}/export/zip`;
}
