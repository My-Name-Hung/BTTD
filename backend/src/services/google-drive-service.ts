/**
 * Google Drive Service — dùng Service Account để upload file biên bản nghiệm thu.
 *
 * Cách setup:
 * 1. Tạo Service Account trong Google Cloud Console.
 * 2. Download file JSON key, đặt vào thư mục backend.
 * 3. Điền GOOGLE_APPLICATION_CREDENTIALS vào .env (đường dẫn đến file JSON).
 * 4. Share folder Google Drive với email Service Account (quyền Editor).
 */

import { google, drive_v3 } from 'googleapis';
import { config } from '../config';

let driveClient: drive_v3.Drive | null = null;

// Nếu có GOOGLE_DRIVE_FOLDER_ID trong config, dùng luôn; không thì tự tạo
let cachedFolderId: string | null = config.google.driveFolderId || null;

/** Khởi tạo Drive client từ Service Account (dùng GOOGLE_APPLICATION_CREDENTIALS) */
function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const credsPath = config.google.credentialsPath;

  if (!credsPath) {
    throw new Error(
      'Chưa cấu hình GOOGLE_APPLICATION_CREDENTIALS trong .env. ' +
      'Đặt đường dẫn đến file JSON key của Service Account (VD: ./gen-lang-client-0456818632-16feae46d4bd.json)'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(require('fs').readFileSync(credsPath, 'utf8')),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Lấy hoặc tạo thư mục "BTTD_BienBan" trên Google Drive.
 * Cache folderId để tránh gọi API nhiều lần.
 */
async function getOrCreateBTTDFolder(drive: drive_v3.Drive): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const folderName = 'BTTD_BienBan';

  // Tìm thư mục đã có
  const res = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  if (res.data.files && res.data.files.length > 0) {
    cachedFolderId = res.data.files[0].id!;
    return cachedFolderId;
  }

  // Tạo thư mục mới
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  if (!folder.data.id) {
    throw new Error('Không tạo được thư mục BTTD_BienBan trên Google Drive');
  }

  // Set quyền công khai cho folder (anyone with link can view)
  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  cachedFolderId = folder.data.id;
  return cachedFolderId;
}

/**
 * Tạo thư mục con theo mã đơn hàng bên trong BTTD_BienBan.
 * Nếu đã tồn tại thì dùng lại.
 */
async function getOrCreateOrderFolder(
  drive: drive_v3.Drive,
  parentFolderId: string,
  maDonHang: string,
): Promise<string> {
  const safeName = `DonHang_${maDonHang.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

  const res = await drive.files.list({
    q: `name='${safeName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  });

  if (!folder.data.id) {
    throw new Error(`Không tạo được thư mục ${safeName} trên Google Drive`);
  }

  // Set quyền công khai cho thư mục con
  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return folder.data.id;
}

/**
 * Upload file lên Google Drive.
 *
 * @param buffer      Nội dung file (từ multer memoryStorage)
 * @param filename    Tên file gốc
 * @param folderPath  Đường dẫn thư mục, ví dụ: "bttd/bien-ban/DH001"
 * @param mimeType    MIME type của file (tự detect nếu không truyền)
 * @returns URL công khai để xem file
 */
export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  const drive = getDriveClient();
  const rootFolder = await getOrCreateBTTDFolder(drive);

  // folderPath dạng "bttd/bien-ban/DH001"
  const parts = filename.split('/');
  let parentId = rootFolder;

  // Tạo thư mục con theo path (nếu có)
  for (const part of parts.slice(0, -1)) {
    parentId = await getOrCreateOrderFolder(drive, parentId, part);
  }

  // Tên file cuối cùng
  const baseName = parts[parts.length - 1];

  // Sinh tên file với timestamp để tránh trùng
  const ext = baseName.includes('.') ? '.' + baseName.split('.').pop() : '';
  const nameWithoutExt = baseName.slice(0, baseName.lastIndexOf('.'));
  const safeFilename = `${nameWithoutExt}_${Date.now()}${ext}`;

  // Detect MIME type từ extension nếu không truyền vào
  const finalMimeType =
    mimeType ||
    getMimeType(baseName) ||
    'application/octet-stream';

  // Upload file
  const file = await drive.files.create({
    requestBody: {
      name: safeFilename,
      parents: [parentId],
    },
    media: {
      mimeType: finalMimeType,
      body: require('stream').Readable.from(buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  if (!file.data.id) {
    throw new Error('Upload Google Drive thất bại: không nhận được file ID');
  }

  // Ưu tiên webViewLink (link xem trong Drive), fallback webContentLink
  return file.data.webViewLink || file.data.webContentLink || '';
}

/**
 * Upload nhiều file lên Google Drive trong thư mục của một đơn hàng.
 *
 * @param buffers     Mảng buffer của các file
 * @param filenames   Mảng tên file tương ứng
 * @param maDonHang  Mã đơn hàng (dùng tạo thư mục con)
 * @returns Mảng URL công khai của các file đã upload
 */
export async function uploadFilesToDrive(
  buffers: Buffer[],
  filenames: string[],
  maDonHang: string,
): Promise<string[]> {
  const drive = getDriveClient();
  const rootFolder = await getOrCreateBTTDFolder(drive);
  const orderFolder = await getOrCreateOrderFolder(drive, rootFolder, maDonHang);

  const urls: string[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    const originalName = filenames[i] || `file_${i}`;

    const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
    const nameWithoutExt = originalName.slice(0, originalName.lastIndexOf('.'));
    const safeFilename = `${nameWithoutExt}_${Date.now()}_${i}${ext}`;
    const mimeType = getMimeType(originalName) || 'application/octet-stream';

    const file = await drive.files.create({
      requestBody: {
        name: safeFilename,
        parents: [orderFolder],
      },
      media: {
        mimeType,
        body: require('stream').Readable.from(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    urls.push(file.data.webViewLink || file.data.webContentLink || '');
  }

  return urls;
}

/** Map extension → MIME type */
function getMimeType(filename: string): string | null {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] || null;
}
