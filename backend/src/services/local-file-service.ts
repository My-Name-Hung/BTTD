import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'nghiem-thu');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'tep';
}

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const safeBase = sanitizeSegment(base);
  const safeExt = ext.replace(/[^.a-zA-Z0-9]/g, '').toLowerCase();
  return `${safeBase}-${Date.now()}${safeExt}`;
}

/** Lưu file biên bản nghiệm thu vào local filesystem và trả về URL public. */
export async function saveUploadedFilesLocally(
  files: Express.Multer.File[],
  maDonHang: string,
): Promise<string[]> {
  ensureDir(UPLOAD_ROOT);

  const orderFolderName = sanitizeSegment(maDonHang);
  const orderFolderPath = path.join(UPLOAD_ROOT, orderFolderName);
  ensureDir(orderFolderPath);

  const savedUrls: string[] = [];

  for (const file of files) {
    const safeFilename = sanitizeFilename(file.originalname);
    const absolutePath = path.join(orderFolderPath, safeFilename);
    await fs.promises.writeFile(absolutePath, file.buffer);
    savedUrls.push(`/uploads/nghiem-thu/${orderFolderName}/${safeFilename}`);
  }

  return savedUrls;
}
