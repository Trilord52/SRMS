import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { REVIEW_STATUSES } from '../lib/constants';

/**
 * A submitted report. Answers live in `templateData`, whose shape is defined by
 * the referenced template rather than by this schema, so `Mixed` is deliberate.
 * Validation happens against the template at submission time.
 */
const reportSchema = new Schema(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
    templateVersion: { type: Number, required: true, default: 1 },
    templateData: { type: Schema.Types.Mixed, default: {} },

    /** Set when this report replaces one that was rejected. */
    revisionOf: { type: Schema.Types.ObjectId, ref: 'Report', default: null },

    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionDate: { type: Date, required: true, default: () => new Date() },

    /**
     * The period the report covers. Supplied by the submitter rather than
     * derived from the submission moment, so a report filed on Monday about the
     * previous week is attributed to the week it describes.
     */
    periodStart: { type: Date, required: true },
    isoYear: { type: Number, required: true },
    isoWeek: { type: Number, required: true, min: 1, max: 53 },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 31 },

    reviewStatus: { type: String, enum: REVIEW_STATUSES, required: true, default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewComments: { type: String, default: null },
    supervisorComments: { type: String, default: null },
    rejectionReason: { type: String, default: null },

    /** GridFS ids of attachments, resolved through the files collection. */
    files: {
      type: [{ type: Schema.Types.ObjectId, ref: 'ReportFile' }],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes mirror the queries the API actually issues: week views, a submitter's
// own history, the review queue, and revision chains.
reportSchema.index({ isoYear: 1, isoWeek: 1, submissionDate: -1 });
reportSchema.index({ submittedBy: 1, submissionDate: -1 });
reportSchema.index({ reviewStatus: 1, submissionDate: -1 });
reportSchema.index({ revisionOf: 1, submissionDate: -1 });
reportSchema.index({ templateId: 1 });

reportSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type Report = InferSchemaType<typeof reportSchema>;
export type ReportDocument = HydratedDocument<Report>;

export const ReportModel = model('Report', reportSchema);
