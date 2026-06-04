/**
 * Google Drive Service — dùng Service Account để upload file biên bản nghiệm thu.
 *
 * LƯU Ý QUAN TRỌNG: Service Account KHÔNG có storage quota trên My Drive cá nhân.
 * PHẢI dùng SHARED DRIVE (Ổ đĩa dùng chung).
 *
 * Cách setup:
 * 1. Tạo Service Account trong Google Cloud Console.
 * 2. Download file JSON key, đặt vào thư mục backend.
 * 3. Điền GOOGLE_APPLICATION_CREDENTIALS vào .env.
 * 4. Tạo một SHARED DRIVE trên Google Drive (không phải My Drive thường).
 * 5. Thêm email Service Account vào Shared Drive với quyền Content Manager / Editor.
 * 6. Copy Folder ID của Shared Drive vào GOOGLE_DRIVE_FOLDER_ID trong .env.
 *    (Lấy từ URL: drive.google.com/drive/folders/[FOLDER_ID])
 */

import { google, drive_v3 } from 'googleapis';
import { config } from '../config';

let driveClient: drive_v3.Drive | null = null;

// Dùng Shared Drive ID từ config (bắt buộc vì Service Account cần Shared Drive)
const SHARED_DRIVE_ID = config.google.driveFolderId || '';
let cachedRootFolderId: string | null = null;

/** Khởi tạo Drive client từ Service Account */
function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const credsPath = config.google.credentialsPath;

  if (!credsPath) {
    throw new Error(
      'Chưa cấu hình GOOGLE_APPLICATION_CREDENTIALS trong .env. ' +
      'Đặt đường dẫn đến file JSON key của Service Account.'
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
 * Các API call luôn cần supportsAllDrives/includeItemsFromAllDrives
 * để hoạt động với Shared Drive.
 */
function listOpts(pageToken?: string) {
  return {
    pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'nextPageToken, files(id, name)',
  } as const;
}

function createOpts<T>(fields: string) {
  return {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields,
  } as const;
}

/**
 * Lấy hoặc tạo thư mục "BTTD_BienBan" bên trong Shared Drive.
 * Nếu dùng Shared Drive và đã set GOOGLE_DRIVE_FOLDER_ID, dùng nó luôn.
 * Nếu không có folderId trong config thì tự tìm/tạo.
 */
async function getOrCreateBTTDFolder(drive: drive_v3.Drive): Promise<string> {
  // Nếu đã set folder cố định trong config (Shared Drive ID hoặc folder con)
  if (cachedRootFolderId) return cachedRootFolderId;

  const folderName = 'BTTD_BienBan';

  // Tìm trong Shared Drive (nếu có SHARED_DRIVE_ID)
  const searchQuery = SHARED_DRIVE_ID
    ? `name='${folderName}' and '${SHARED_DRIVE_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners`;

  const res = await drive.files.list({
    q: searchQuery,
    ...listOpts(),
    pageSize: 1,
  } as drive_v3.Params$Resource$Files$List);

  if (res.data.files && res.data.files.length > 0) {
    cachedRootFolderId = res.data.files[0].id!;
    return cachedRootFolderId;
  }

  // Tạo thư mục mới trong Shared Drive
  const requestBody: drive_v3.Schema$File = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(SHARED_DRIVE_ID ? { parents: [SHARED_DRIVE_ID] } : {}),
  };

  const folder = await drive.files.create({
    requestBody,
    ...createOpts<drive_v3.Params$Resource$Files$Create>('id'),
  });

  if (!folder.data.id) {
    throw new Error('Không tạo được thư mục BTTD_BienBan trên Google Drive');
  }

  // Share công khai để ai có link cũng xem được
  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  } as drive_v3.Params$Resource$Permissions$Create);

  cachedRootFolderId = folder.data.id;
  return cachedRootFolderId;
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
    ...listOpts(),
    pageSize: 1,
  } as drive_v3.Params$Resource$Files$List);

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    ...createOpts<drive_v3.Params$Resource$Files$Create>('id'),
  });

  if (!folder.data.id) {
    throw new Error(`Không tạo được thư mục ${safeName} trên Google Drive`);
  }

  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  } as drive_v3.Params$Resource$Permissions$Create);

  return folder.data.id;
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

/**
 * Upload một file lên Google Drive.
 * @returns URL xem file công khai trên Drive
 */
export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  const drive = getDriveClient();
  const rootFolder = await getOrCreateBTTDFolder(drive);

  const parts = filename.split('/');
  let parentId = rootFolder;

  for (const part of parts.slice(0, -1)) {
    parentId = await getOrCreateOrderFolder(drive, parentId, part);
  }

  const baseName = parts[parts.length - 1];
  const dotIdx = baseName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? baseName.slice(dotIdx) : '';
  const safeFilename = `${baseName.slice(0, dotIdx || baseName.length)}_${Date.now()}${ext}`;
  const finalMimeType = mimeType || getMimeType(baseName) || 'application/octet-stream';

  const file = await drive.files.create({
    requestBody: { name: safeFilename, parents: [parentId] },
    media: { mimeType: finalMimeType, body: require('stream').Readable.from(buffer) },
    ...createOpts<drive_v3.Params$Resource$Files$Create>('id, webViewLink, webContentLink'),
  });

  if (!file.data.id) {
    throw new Error('Upload Google Drive thất bại: không nhận được file ID');
  }

  return file.data.webViewLink || file.data.webContentLink || '';
}

/**
 * Upload nhiều file lên Google Drive trong thư mục của một đơn hàng.
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
    const originalName = filenames[i] || `file_${i}`;
    const dotIdx = originalName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? originalName.slice(dotIdx) : '';
    const safeFilename = `${originalName.slice(0, dotIdx || originalName.length)}_${Date.now()}_${i}${ext}`;
    const mimeType = getMimeType(originalName) || 'application/octet-stream';

    const file = await drive.files.create({
      requestBody: { name: safeFilename, parents: [orderFolder] },
      media: { mimeType, body: require('stream').Readable.from(buffers[i]) },
      ...createOpts<drive_v3.Params$Resource$Files$Create>('id, webViewLink, webContentLink'),
    });

    urls.push(file.data.webViewLink || file.data.webContentLink || '');
  }

  return urls;
}
