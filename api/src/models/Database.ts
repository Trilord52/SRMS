import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CUSTOM_FEATURE_TYPES } from '../lib/constants';

/**
 * Inventory of database servers a manager tracks. These are records about
 * external systems; the API does not connect to them.
 */
const customFeatureSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOM_FEATURE_TYPES, required: true },
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    /** Choices when `type` is `enum`. */
    enumOptions: { type: [String], default: [] },
    defaultValue: { type: String, default: null },
    description: { type: String, default: null },
  },
  { _id: true }
);

const databaseSchema = new Schema(
  {
    database: { type: String, required: true, trim: true },
    databaseType: { type: String, required: true, trim: true },
    /** Validated as an IPv4 address or hostname at the schema layer. */
    ipAddress: { type: String, required: true, trim: true },
    dbVersion: { type: String, required: true, trim: true },
    osVersion: { type: String, required: true, trim: true },
    customFeatures: { type: [customFeatureSchema], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

databaseSchema.index({ isActive: 1, database: 1 });
databaseSchema.index({ createdBy: 1 });

databaseSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type DatabaseRecord = InferSchemaType<typeof databaseSchema>;
export type DatabaseDocument = HydratedDocument<DatabaseRecord>;

export const DatabaseModel = model('Database', databaseSchema);
