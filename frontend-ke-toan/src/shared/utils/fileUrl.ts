export function buildFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const origin = window.location.origin;
  return `${origin}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}
