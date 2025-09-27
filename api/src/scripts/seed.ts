#!/usr/bin/env tsx
/**
 * Development seed.
 *
 * Creates one account per role, a template exercising every field type, and a
 * few reports in different review states, so the interface has something real to
 * show without hand-entering data.
 *
 *   npm run seed
 *
 * Refuses to run against a production database.
 */

import mongoose from 'mongoose';
import { config } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { periodPartsFor } from '../lib/isoWeek';
import { hashPassword } from '../lib/password';
import { DatabaseModel } from '../models/Database';
import { ReportModel } from '../models/Report';
import { TemplateModel } from '../models/Template';
import { UserModel } from '../models/User';

const PASSWORDS = {
  staff: 'staff-password-123',
  supervisor: 'supervisor-password-123',
  manager: 'manager-password-123',
} as const;

async function main(): Promise<void> {
  if (config.isProduction) {
    throw new Error('Refusing to seed a production database');
  }

  await connectDatabase();
  console.log(`Seeding ${mongoose.connection.name}`);

  // Clearing first keeps repeat runs idempotent rather than accumulating rows.
  await Promise.all([
    UserModel.deleteMany({}),
    TemplateModel.deleteMany({}),
    ReportModel.deleteMany({}),
    DatabaseModel.deleteMany({}),
  ]);

  const [staff, supervisor, manager] = await Promise.all(
    (['staff', 'supervisor', 'manager'] as const).map(async (role) =>
      UserModel.create({
        firstName: role[0]!.toUpperCase() + role.slice(1),
        lastName: 'Demo',
        userId: `${role.toUpperCase()}001`,
        email: `${role}@bankofabyssinia.com`,
        passwordHash: await hashPassword(PASSWORDS[role]),
        role,
        accountStatus: 'approved',
        department: 'Database Administration',
      })
    )
  );

  // One pending registration so the approvals queue is not empty.
  await UserModel.create({
    firstName: 'Hanna',
    lastName: 'Applicant',
    userId: 'STAFF002',
    email: 'hanna.applicant@bankofabyssinia.com',
    passwordHash: await hashPassword('applicant-password-123'),
    role: 'staff',
    accountStatus: 'pending',
    department: 'Operations',
  });

  const template = await TemplateModel.create({
    name: 'Weekly Database Health Check',
    description: 'The weekly report covering database health, incidents, and backups.',
    category: 'weekly',
    createdBy: manager!._id,
    fields: [
      {
        name: 'summary',
        type: 'text',
        label: 'Summary',
        required: true,
        order: 1,
        validators: { minLength: 10, maxLength: 200 },
      },
      {
        name: 'incidentCount',
        type: 'number',
        label: 'Incidents this week',
        required: true,
        order: 2,
        validators: { min: 0, max: 999 },
      },
      {
        name: 'severity',
        type: 'select',
        label: 'Highest severity',
        required: true,
        order: 3,
        options: [
          { value: 'none', label: 'None' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ],
      },
      { name: 'backupVerified', type: 'yesno', label: 'Backups verified', required: true, order: 4 },
      { name: 'acknowledged', type: 'checkbox', label: 'Checklist completed', required: true, order: 5 },
      { name: 'notes', type: 'textarea', label: 'Notes', order: 6, validators: { maxLength: 2000 } },
      { name: 'lastPatched', type: 'date', label: 'Last patched', order: 7 },
    ],
  });

  await DatabaseModel.create([
    {
      name: 'CoreBankingDB',
      databaseType: 'Oracle',
      host: '10.20.30.11',
      dbVersion: '19c',
      osVersion: 'RHEL 8.9',
      createdBy: manager!._id,
      customFeatures: [
        { name: 'replicaCount', type: 'number', label: 'Replica count', required: true },
        {
          name: 'tier',
          type: 'enum',
          label: 'Service tier',
          enumOptions: ['gold', 'silver', 'bronze'],
        },
      ],
    },
    {
      name: 'ReportingDB',
      databaseType: 'PostgreSQL',
      host: 'reporting.db.internal',
      dbVersion: '16.1',
      osVersion: 'Ubuntu 24.04',
      createdBy: manager!._id,
    },
    {
      name: 'LegacyArchiveDB',
      databaseType: 'MySQL',
      host: '10.20.30.44',
      dbVersion: '5.7',
      osVersion: 'CentOS 7',
      createdBy: manager!._id,
      isActive: false,
    },
  ]);

  /** Reports across several weeks and every review state. */
  const submissions = [
    {
      periodStart: '2026-07-06',
      reviewStatus: 'approved' as const,
      reviewedAfterHours: 6,
      data: {
        summary: 'All primaries healthy, no incidents recorded this week.',
        incidentCount: 0,
        severity: 'none',
        backupVerified: 'yes',
        acknowledged: true,
        notes: 'Routine week.',
      },
    },
    {
      periodStart: '2026-07-13',
      reviewStatus: 'approved' as const,
      reviewedAfterHours: 30,
      data: {
        summary: 'Two brief replication lags on the reporting replica.',
        incidentCount: 2,
        severity: 'low',
        backupVerified: 'yes',
        acknowledged: true,
      },
    },
    {
      periodStart: '2026-07-20',
      reviewStatus: 'rejected' as const,
      reviewedAfterHours: 12,
      rejectionReason: 'Attach the incident log for the failover on Wednesday.',
      data: {
        summary: 'Unplanned failover on the core cluster, service restored.',
        incidentCount: 1,
        severity: 'high',
        backupVerified: 'no',
        acknowledged: true,
      },
    },
    {
      periodStart: '2026-07-27',
      reviewStatus: 'pending' as const,
      data: {
        summary: 'Patching completed across all non-production instances.',
        incidentCount: 0,
        severity: 'none',
        backupVerified: 'yes',
        acknowledged: true,
        lastPatched: new Date('2026-07-29'),
      },
    },
    {
      periodStart: '2026-08-03',
      reviewStatus: 'pending' as const,
      data: {
        summary: 'Storage utilisation approaching threshold on the archive host.',
        incidentCount: 1,
        severity: 'medium',
        backupVerified: 'yes',
        acknowledged: true,
        notes: 'Capacity request raised with infrastructure.',
      },
    },
  ];

  for (const submission of submissions) {
    const periodStart = new Date(`${submission.periodStart}T00:00:00Z`);
    // Submitted the Monday after the period it covers.
    const submissionDate = new Date(periodStart.getTime() + 7 * 86_400_000);

    await ReportModel.create({
      templateId: template._id,
      templateVersion: template.version,
      templateData: submission.data,
      submittedBy: staff!._id,
      submissionDate,
      periodStart,
      ...periodPartsFor(periodStart),
      reviewStatus: submission.reviewStatus,
      reviewedBy: submission.reviewStatus === 'pending' ? null : supervisor!._id,
      reviewedAt:
        submission.reviewedAfterHours === undefined
          ? null
          : new Date(submissionDate.getTime() + submission.reviewedAfterHours * 3_600_000),
      rejectionReason: submission.rejectionReason ?? null,
      files: [],
    });
  }

  console.log('\nSeeded:');
  console.log(`  users:      ${await UserModel.countDocuments()} (3 approved, 1 pending)`);
  console.log(`  templates:  ${await TemplateModel.countDocuments()}`);
  console.log(`  reports:    ${await ReportModel.countDocuments()}`);
  console.log(`  databases:  ${await DatabaseModel.countDocuments()}`);
  console.log('\nSign in with:');
  for (const [role, password] of Object.entries(PASSWORDS)) {
    console.log(`  ${role.padEnd(11)} ${role}@bankofabyssinia.com / ${password}`);
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
