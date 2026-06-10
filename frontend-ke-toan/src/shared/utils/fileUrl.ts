const FILE_BASE_URL =
  import.meta.env.VITE_API_WS_URL || "https://apibttd.ximangtaydo.vn";

export function buildFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${FILE_BASE_URL}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}
