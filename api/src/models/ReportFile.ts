import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Metadata for an uploaded attachment. The bytes live in GridFS, keyed by
 * `gridFsId`, so files survive a redeploy — the legacy implementation wrote to
 * local disk, which is discarded on every deploy on a hosted platform.
 *
 * `storedName` is generated server-side. The client's filename is kept only as
 * `originalName` for display and is never used to build a path.
 */
const reportFileSchema = new Schema(
  {
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    storedName: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', default: null },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

reportFileSchema.index({ reportId: 1 });
reportFileSchema.index({ uploadedBy: 1 });

reportFileSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    delete ret.gridFsId;
    return ret;
  },
});

export type ReportFile = InferSchemaType<typeof reportFileSchema>;
export type ReportFileDocument = HydratedDocument<ReportFile>;

export const ReportFileModel = model('ReportFile', reportFileSchema);
