/**
 * Domain vocabulary shared across models, schemas, and routes.
 *
 * Two independent approval workflows exist and both use the words pending,
 * approved, and rejected. They are kept as separate types so a report status
 * can never be assigned where an account status is expected.
 */

export const ROLES = ['staff', 'supervisor', 'manager'] as const;
export type Role = (typeof ROLES)[number];

/** Whether an account may sign in. Managers are approved on registration. */
export const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Whether a submitted report has been reviewed. */
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const TEMPLATE_CATEGORIES = [
  'weekly',
  'weekly-report',
  'incident',
  'incident-report',
  'maintenance',
  'maintenance-report',
  'database-report',
  'health-check',
  'custom',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Field types a manager can place on a report template. */
export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'textarea',
  'file',
  'yesno',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Extra attributes a manager can attach to a database inventory record. */
export const CUSTOM_FEATURE_TYPES = ['enum', 'input', 'number', 'date'] as const;
export type CustomFeatureType = (typeof CUSTOM_FEATURE_TYPES)[number];

/** Roles permitted to review submitted reports. */
export const CAN_REVIEW_REPORTS: readonly Role[] = ['supervisor', 'manager'];

/**
 * Whose password each role may reset. The legacy implementation encoded this
 * as nested conditionals in one handler; as data it can be asserted in tests.
 */
export const PASSWORD_RESET_TARGETS: Record<Role, readonly Role[]> = {
  staff: [],
  supervisor: ['staff'],
  manager: ['staff', 'supervisor'],
};
