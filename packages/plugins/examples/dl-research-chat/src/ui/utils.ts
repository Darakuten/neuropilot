export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fileIcon(name: string | null, mime: string): string {
  const lower = (name ?? "").toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".md") || mime.startsWith("text/markdown")) return "MD";
  if (lower.endsWith(".txt") || mime === "text/plain") return "TXT";
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "PPT";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "XLS";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "DOC";
  if (lower.endsWith(".tex")) return "TeX";
  if (mime.startsWith("image/")) return "IMG";
  if (mime.startsWith("video/")) return "VID";
  if (mime.startsWith("audio/")) return "AUD";
  return "FILE";
}

export function statusColor(status: string, palette: { pi: string; muted: string; accent: string; danger: string }): string {
  if (status === "done" || status === "completed") return palette.pi;
  if (status === "cancelled") return palette.muted;
  if (status === "in_review" || status === "in_progress" || status === "running") return palette.accent;
  if (status === "blocked") return palette.danger;
  return palette.muted;
}
