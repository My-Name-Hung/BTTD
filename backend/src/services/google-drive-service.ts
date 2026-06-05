/**
 * Google Drive Service — upload file biên bản nghiệm thu dùng Service Account.
 *
 * YÊU CẦU BẮT BUỘC:
 * - Phải dùng SHARED DRIVE (Ổ đĩa dùng chung), KHÔNG phải My Drive thường.
 * - Service Account KHÔNG có storage quota trên My Drive.
 *
 * Cách setup:
 * 1. Tạo Service Account trong Google Cloud Console, download file JSON key.
 * 2. Tạo SHARED DRIVE trên Google Drive (https://drive.google.com → Dùng chung với tôi → Tạo ổ đĩa dùng chung).
 * 3. Thêm email Service Account vào Shared Drive (quyền Content Manager hoặc Editor).
 * 4. Điền GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_DRIVE_FOLDER_ID vào .env.
 * 5. GOOGLE_DRIVE_FOLDER_ID = ID của Shared Drive (lấy từ URL folder).
 */

import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let driveClient: drive_v3.Drive | null = null;

// Folder đích cuối cùng: dùng trực tiếp GOOGLE_DRIVE_FOLDER_ID
const ROOT_FOLDER_ID = config.google.driveFolderId;
let cachedFolderId: string | null = null;

function getServiceAccountCredentials() {
  const inlineKey = config.google.serviceAccountKey?.trim();
  const serviceAccountEmail = config.google.serviceAccountEmail?.trim();

  if (inlineKey && serviceAccountEmail) {
    return {
      client_email: serviceAccountEmail,
      private_key: inlineKey.replace(/\\n/g, '\n'),
    };
  }

  const credsPath = config.google.credentialsPath?.trim();
  if (!credsPath) {
    throw new Error(
      'Chưa cấu hình Google Service Account. Hãy đặt GOOGLE_SERVICE_ACCOUNT_KEY + GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  const resolvedPath = path.isAbsolute(credsPath)
    ? credsPath
    : path.resolve(process.cwd(), credsPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Không tìm thấy file Service Account tại "${resolvedPath}". Hãy kiểm tra GOOGLE_APPLICATION_CREDENTIALS trên môi trường deploy.`
    );
  }

  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

/** Khởi tạo Drive client từ Service Account */
function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Các Drive API call luôn cần supportsAllDrives/includeItemsFromAllDrives
 * để hoạt động với Shared Drive.
 */
const driveOpts = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const;

/**
 * Lấy folder ID để upload.
 * - Nếu có GOOGLE_DRIVE_FOLDER_ID → dùng luôn (đây phải là Shared Drive).
 * - Nếu không có → tạo thư mục "BTTD_BienBan" trong Shared Drive root.
 */
async function resolveFolderId(drive: drive_v3.Drive): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  if (ROOT_FOLDER_ID) {
    // Xác nhận folder tồn tại và accessible
    try {
      await drive.files.get({
        fileId: ROOT_FOLDER_ID,
        fields: 'id, name, mimeType',
        ...driveOpts,
      } as drive_v3.Params$Resource$Files$Get);
      cachedFolderId = ROOT_FOLDER_ID;
      return cachedFolderId;
    } catch (err: any) {
      if (err?.status === 404) {
        throw new Error(
          `Không tìm thấy folder với ID "${ROOT_FOLDER_ID}". ` +
          `Hãy đảm bảo đây là SHARED DRIVE (không phải My Drive thường) ` +
          `và Service Account đã được thêm vào Shared Drive.`
        );
      }
      throw err;
    }
  }

  // Không có folder ID → thông báo rõ ràng
  throw new Error(
    'Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID trong .env. ' +
    'Hãy tạo một SHARED DRIVE trên Google Drive, thêm Service Account vào đó, ' +
    'rồi copy Folder ID vào GOOGLE_DRIVE_FOLDER_ID.'
  );
}

/**
 * Tạo thư mục con bên trong folder đích.
 * Nếu đã tồn tại thì trả về ID hiện có.
 */
async function getOrCreateSubFolder(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string,
): Promise<string> {
  // Tìm thư mục con
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    ...driveOpts,
    pageSize: 1,
    fields: 'nextPageToken, files(id, name)',
  } as drive_v3.Params$Resource$Files$List);

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Tạo mới
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    ...driveOpts,
  } as drive_v3.Params$Resource$Files$Create);

  if (!created.data.id) {
    throw new Error(`Không tạo được thư mục "${folderName}" trên Google Drive`);
  }

  // Share công khai để ai có link cũng xem được
  await drive.permissions.create({
    fileId: created.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
    ...driveOpts,
  } as drive_v3.Params$Resource$Permissions$Create);

  return created.data.id;
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
 * Tạo thư mục con "BTTD_BienBan" bên trong folder đích nếu chưa có.
 *
 * @returns URL xem file công khai trên Drive
 */
export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  const drive = getDriveClient();
  const folderId = await resolveFolderId(drive);

  // Tạo thư mục con nếu cần
  const subFolderId = await getOrCreateSubFolder(drive, folderId, 'BTTD_BienBan');

  // Tách path: phần cuối là tên file, trước đó là tên thư mục con
  const parts = filename.split('/');
  let parentId = subFolderId;

  for (const part of parts.slice(0, -1)) {
    parentId = await getOrCreateSubFolder(drive, parentId, part);
  }

  const baseName = parts[parts.length - 1];
  const dotIdx = baseName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? baseName.slice(dotIdx) : '';
  const safeFilename = `${baseName.slice(0, dotIdx || baseName.length)}_${Date.now()}${ext}`;
  const finalMimeType = mimeType || getMimeType(baseName) || 'application/octet-stream';

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
    ...driveOpts,
  } as drive_v3.Params$Resource$Files$Create);

  if (!file.data.id) {
    throw new Error('Upload Google Drive thất bại: không nhận được file ID');
  }

  return file.data.webViewLink || file.data.webContentLink || '';
}

/**
 * Upload nhiều file lên Google Drive trong thư mục con của đơn hàng.
 * Có retry 1 lần nếu lỗi tạm thời.
 *
 * @returns Mảng URL công khai của các file đã upload
 */
export async function uploadFilesToDrive(
  buffers: Buffer[],
  filenames: string[],
  maDonHang: string,
): Promise<string[]> {
  const drive = getDriveClient();
  const folderId = await resolveFolderId(drive);
  const bttdFolderId = await getOrCreateSubFolder(drive, folderId, 'BTTD_BienBan');
  const orderFolderId = await getOrCreateSubFolder(
    drive,
    bttdFolderId,
    `DonHang_${maDonHang.replace(/[^a-zA-Z0-9_\-]/g, '_')}`,
  );

  const urls: string[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const originalName = filenames[i] || `file_${i}`;
    const dotIdx = originalName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? originalName.slice(dotIdx) : '';
    const safeFilename = `${originalName.slice(0, dotIdx || originalName.length)}_${Date.now()}_${i}${ext}`;
    const mimeType = getMimeType(originalName) || 'application/octet-stream';

    let file: drive_v3.Schema$File | null = null;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await drive.files.create({
          requestBody: {
            name: safeFilename,
            parents: [orderFolderId],
          },
          media: {
            mimeType,
            body: require('stream').Readable.from(buffers[i]),
          },
          fields: 'id, webViewLink, webContentLink',
          ...driveOpts,
        } as drive_v3.Params$Resource$Files$Create);
        file = result.data ?? null;
        break; // thành công
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { code?: number }).code;
        if (attempt === 1 && (status === 403 || status === 500 || status === 503)) {
          await new Promise<void>((r) => setTimeout(r, 1000));
          continue;
        }
        break;
      }
    }

    if (!file?.id) {
      const msg = lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
      throw new Error(`Upload file "${originalName}" lên Google Drive thất bại: ${msg}`);
    }

    const url = file.webViewLink || file.webContentLink || '';
    if (!url) {
      // Upload thành công nhưng không lấy được link → thử get lại
      try {
        const refreshed = await drive.files.get({
          fileId: file.id!,
          fields: 'webViewLink, webContentLink',
          ...driveOpts,
        } as drive_v3.Params$Resource$Files$Get);
        urls.push(refreshed.data?.webViewLink || refreshed.data?.webContentLink || '');
      } catch {
        urls.push('');
      }
    } else {
      urls.push(url);
    }
  }

  return urls;
}
