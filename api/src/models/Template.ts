import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { FIELD_TYPES, TEMPLATE_CATEGORIES } from '../lib/constants';

/**
 * A template is a manager-authored form definition. Reports render from it and
 * are validated against it, so the field vocabulary here is the contract that
 * the dynamic form and the submission validator both depend on.
 */
const fieldSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: FIELD_TYPES, required: true },
    label: { type: String, required: true, trim: true },
    placeholder: { type: String, default: '' },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    required: { type: Boolean, default: false },
    /** Choices for `select`. Ignored by other field types. */
    options: {
      type: [{ value: { type: String, required: true }, label: { type: String, required: true } }],
      default: [],
    },
    validators: {
      minLength: { type: Number, default: null },
      maxLength: { type: Number, default: null },
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      /** Anchored at use, and length-capped, so a template cannot ship a runaway pattern. */
      pattern: { type: String, default: null, maxlength: 200 },
      customMessage: { type: String, default: null },
    },
    order: { type: Number, default: 0 },
    readOnly: { type: Boolean, default: false },
  },
  { _id: true }
);

const templateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: TEMPLATE_CATEGORIES, required: true },
    fields: { type: [fieldSchema], default: [] },
    isActive: { type: Boolean, default: true },
    /**
     * Incremented whenever fields change. Reports record the version they were
     * submitted against, so historic answers stay interpretable after an edit.
     */
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ createdBy: 1 });

templateSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type TemplateField = InferSchemaType<typeof fieldSchema>;
export type Template = InferSchemaType<typeof templateSchema>;
export type TemplateDocument = HydratedDocument<Template>;

export const TemplateModel = model('Template', templateSchema);
