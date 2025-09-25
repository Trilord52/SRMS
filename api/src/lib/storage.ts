import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { ReportFileModel, type ReportFileDocument } from '../models/ReportFile';

/**
 * Attachment storage backed by GridFS.
 *
 * The legacy implementation wrote uploads to a local `uploads/` directory, which
 * a hosted platform discards on every deploy, and built the download path by
 * joining a client-supplied filename onto it. Storing bytes in the database
 * removes both problems: files survive deploys, and there is no filesystem path
 * for a request to escape.
 *
 * GridFSBucket and ObjectId come from mongoose's own driver re-export. Importing
 * them from `mongodb` directly picks up a second copy of the driver whose types
 * are not assignable to mongoose's.
 */
const { GridFSBucket, ObjectId } = mongoose.mongo;

const BUCKET_NAME = 'reportFiles';

function bucket(): InstanceType<typeof GridFSBucket> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection is not established');
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

/**
 * Server-generated storage name. The client's filename never influences it, so
 * a crafted name cannot collide with another file or traverse anywhere.
 */
function makeStoredName(originalName: string): string {
  const extension = originalName.includes('.')
    ? `.${originalName.split('.').pop()!.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toLowerCase()}`
    : '';
  return `${randomUUID()}${extension}`;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function storeFile(
  file: UploadedFile,
  uploadedBy: string
): Promise<ReportFileDocument> {
  const storedName = makeStoredName(file.originalname);

  const gridFsId = await new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const stream = bucket().openUploadStream(storedName, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname, uploadedBy },
    });

    Readable.from(file.buffer)
      .pipe(stream)
      .on('error', reject)
      .on('finish', () => resolve(stream.id as unknown as mongoose.Types.ObjectId));
  });

  return ReportFileModel.create({
    gridFsId,
    storedName,
    // Kept for display only. Stripped of any path component so a name like
    // "../../etc/passwd" cannot be echoed back as a usable path.
    originalName: file.originalname.split(/[/\\]/).pop() ?? 'attachment',
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy,
  });
}

/** Streams a stored file's bytes. The caller must have already authorised access. */
export function openDownloadStream(gridFsId: mongoose.Types.ObjectId): Readable {
  return bucket().openDownloadStream(new ObjectId(gridFsId.toString()));
}

export async function deleteFile(fileId: mongoose.Types.ObjectId): Promise<void> {
  const record = await ReportFileModel.findById(fileId);
  if (!record) return;

  try {
    await bucket().delete(new ObjectId(record.gridFsId.toString()));
  } catch {
    // Already gone from GridFS; removing the metadata is still correct.
  }

  await record.deleteOne();
}

export async function deleteFiles(fileIds: readonly mongoose.Types.ObjectId[]): Promise<void> {
  await Promise.all(fileIds.map((id) => deleteFile(id)));
}
