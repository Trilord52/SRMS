import { z } from 'zod';
import { ROLES } from '../lib/constants';
import { config } from '../config/env';

const domain = config.ALLOWED_EMAIL_DOMAIN;

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Must be a 24-character hexadecimal id');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .refine((value) => value.endsWith(`@${domain}`), {
    message: `Email must be a ${domain} address`,
  });

/**
 * Password policy. The legacy implementation had none — registration and reset
 * both accepted any string, including an empty one.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  userId: z.string().trim().min(1, 'User ID is required').max(40),
  email: emailSchema,
  password: passwordSchema,
  // Self-registering as a manager is not permitted; managers are promoted by
  // an existing manager. The legacy API auto-approved anyone claiming the role.
  role: z.enum(['staff', 'supervisor']).default('staff'),
  department: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const approvalDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((value) => value.decision !== 'rejected' || Boolean(value.rejectionReason), {
    message: 'A reason is required when rejecting a registration',
    path: ['rejectionReason'],
  });

export const resetPasswordSchema = z.object({
  targetUserId: objectIdSchema,
  newPassword: passwordSchema,
});

/** A user changing their own password must prove they know the current one. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  accountStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
