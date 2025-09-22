import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ACCOUNT_STATUSES, ROLES } from '../lib/constants';
import { config } from '../config/env';

/**
 * Emails are stored lowercase so the same address cannot be registered twice
 * under different casing. The legacy implementation compared them verbatim,
 * which let `Foo@…` and `foo@…` exist as separate accounts.
 */
const emailPattern = new RegExp(
  `^[\\w.-]+@${config.ALLOWED_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`
);

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    userId: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, `Email must be a ${config.ALLOWED_EMAIL_DOMAIN} address`],
    },
    /** bcrypt hash. Never selected by default so it cannot leak into a response. */
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'staff' },

    // Account approval. Distinct from a report's review status.
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    department: { type: String, trim: true, default: null },
    phoneNumber: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

userSchema.index({ accountStatus: 1, role: 1 });

/**
 * Approval is derived rather than stored. The legacy schema kept both an
 * `isApproved` boolean and an `approvalStatus` string, which could disagree.
 */
userSchema.virtual('isApproved').get(function (this: { accountStatus: string }) {
  return this.accountStatus === 'approved';
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
