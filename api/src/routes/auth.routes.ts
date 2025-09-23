import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { config } from '../config/env';
import { PASSWORD_RESET_TARGETS, type Role } from '../lib/constants';
import {
  conflict,
  forbidden,
  invalidCredentials,
  notFound,
  unauthenticated,
  AppError,
} from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { authenticate, requireRole, signToken } from '../middleware/auth';
import { validate, validatedQuery } from '../middleware/validate';
import { UserModel } from '../models/User';
import {
  approvalDecisionSchema,
  changePasswordSchema,
  listUsersQuerySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  objectIdSchema,
  type ApprovalDecisionInput,
  type ChangePasswordInput,
  type ListUsersQuery,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '../schemas/auth.schema';
import { z } from 'zod';

export const authRouter = Router();

/**
 * Login is rate limited per address. The legacy endpoint had no throttling at
 * all, so password guessing was bounded only by network speed.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many sign-in attempts. Try again in a few minutes.',
      },
    });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

authRouter.post(
  '/register',
  registerLimiter,
  validate('body', registerSchema),
  async (req: Request, res: Response) => {
    const input = req.body as RegisterInput;

    const existing = await UserModel.findOne({
      $or: [{ email: input.email }, { userId: input.userId }],
    })
      .select('_id email userId')
      .lean();

    if (existing) {
      // Which field collided is safe to disclose: both are chosen by the user
      // and the registration form needs to know which one to flag.
      const field = existing.email === input.email ? 'email' : 'userId';
      throw conflict(`That ${field} is already registered`);
    }

    const user = await UserModel.create({
      firstName: input.firstName,
      lastName: input.lastName,
      userId: input.userId,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      // Every self-registration waits for a manager. The legacy API approved
      // anyone who claimed the manager role in the request body.
      accountStatus: 'pending',
      department: input.department ?? null,
      phoneNumber: input.phoneNumber ?? null,
    });

    res.status(201).json({
      message: 'Registration submitted. A manager will review your account.',
      user: user.toJSON(),
    });
  }
);

authRouter.post(
  '/login',
  loginLimiter,
  validate('body', loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginInput;

    const user = await UserModel.findOne({ email }).select('+passwordHash');

    // Hash a throwaway value when the account does not exist so the response
    // time does not reveal whether the address is registered.
    const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const passwordMatches = await verifyPassword(password, hash);

    if (!user || !passwordMatches) {
      throw invalidCredentials();
    }

    if (user.accountStatus === 'pending') {
      throw new AppError(403, 'ACCOUNT_PENDING', 'Your account is awaiting manager approval.');
    }

    if (user.accountStatus === 'rejected') {
      throw new AppError(403, 'ACCOUNT_REJECTED', 'Your registration was not approved.', {
        meta: { rejectionReason: user.rejectionReason ?? null },
      });
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role as Role,
      email: user.email,
    });

    res.json({ token, user: user.toJSON() });
  }
);

authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.auth!.userId);
  if (!user) throw unauthenticated('Account no longer exists');
  res.json({ user: user.toJSON() });
});

authRouter.post(
  '/change-password',
  authenticate,
  validate('body', changePasswordSchema),
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;

    const user = await UserModel.findById(req.auth!.userId).select('+passwordHash');
    if (!user) throw unauthenticated('Account no longer exists');

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw invalidCredentials();
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ message: 'Password updated.' });
  }
);

authRouter.get(
  '/users',
  authenticate,
  requireRole('supervisor', 'manager'),
  validate('query', listUsersQuerySchema),
  async (req: Request, res: Response) => {
    const { role, accountStatus, page, limit } = validatedQuery<ListUsersQuery>(req);

    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (accountStatus) filter.accountStatus = accountStatus;

    // A supervisor's view is limited to staff; only managers see everyone.
    if (req.auth!.role === 'supervisor') filter.role = 'staff';

    const [users, totalCount] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      UserModel.countDocuments(filter),
    ]);

    res.json({
      users: users.map((user) => user.toJSON()),
      pagination: buildPagination(page, limit, totalCount),
    });
  }
);

authRouter.get(
  '/registrations/pending',
  authenticate,
  requireRole('manager'),
  async (_req: Request, res: Response) => {
    const users = await UserModel.find({ accountStatus: 'pending' }).sort({ createdAt: 1 });
    res.json({ users: users.map((user) => user.toJSON()) });
  }
);

authRouter.patch(
  '/registrations/:userId',
  authenticate,
  requireRole('manager'),
  validate('params', z.object({ userId: objectIdSchema })),
  validate('body', approvalDecisionSchema),
  async (req: Request, res: Response) => {
    const { decision, rejectionReason } = req.body as ApprovalDecisionInput;
    const user = await UserModel.findById(req.params.userId);

    if (!user) throw notFound('User');
    if (user.accountStatus !== 'pending') {
      throw conflict(`This registration was already ${user.accountStatus}`);
    }

    user.accountStatus = decision;
    user.approvedBy = new Types.ObjectId(req.auth!.userId);
    user.approvedAt = new Date();
    user.rejectionReason = decision === 'rejected' ? (rejectionReason ?? null) : null;
    await user.save();

    res.json({ message: `Registration ${decision}.`, user: user.toJSON() });
  }
);

authRouter.post(
  '/reset-password',
  authenticate,
  requireRole('supervisor', 'manager'),
  validate('body', resetPasswordSchema),
  async (req: Request, res: Response) => {
    const { targetUserId, newPassword } = req.body as ResetPasswordInput;

    const target = await UserModel.findById(targetUserId).select('+passwordHash');
    if (!target) throw notFound('User');

    // Who may reset whose password is declared as data in one place, so the
    // rule can be asserted directly in tests.
    const permitted = PASSWORD_RESET_TARGETS[req.auth!.role];
    if (!permitted.includes(target.role as Role)) {
      throw forbidden(
        `A ${req.auth!.role} may reset passwords for: ${permitted.join(', ') || 'no one'}`
      );
    }

    if (target._id.toString() === req.auth!.userId) {
      throw forbidden('Use change-password to update your own password');
    }

    target.passwordHash = await hashPassword(newPassword);
    await target.save();

    res.json({ message: `Password reset for ${target.firstName} ${target.lastName}.` });
  }
);

function buildPagination(page: number, limit: number, totalCount: number) {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
