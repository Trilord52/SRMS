import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ReportFileModel } from '../models/ReportFile';
import { ReportModel } from '../models/Report';
import { authHeader, seedUser, type SeededUser } from '../test/factories';

let memoryServer: MongoMemoryServer;
let app: Express;
let staff: SeededUser;
let otherStaff: SeededUser;
let supervisor: SeededUser;
let manager: SeededUser;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('srms_reports_test'));
  app = createApp();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
  staff = await seedUser(app, 'staff');
  otherStaff = await seedUser(app, 'staff');
  supervisor = await seedUser(app, 'supervisor');
  manager = await seedUser(app, 'manager');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await memoryServer.stop();
});

/** A template exercising every field type the schema supports. */
const fullTemplate = {
  name: 'Weekly Database Health',
  description: 'Every field type, so the compiler is exercised end to end.',
  category: 'weekly' as const,
  fields: [
    { name: 'summary', type: 'text', label: 'Summary', required: true, order: 1,
      validators: { minLength: 3, maxLength: 200 } },
    { name: 'incidentCount', type: 'number', label: 'Incidents', required: true, order: 2,
      validators: { min: 0, max: 100 } },
    { name: 'checkedOn', type: 'date', label: 'Checked on', required: true, order: 3 },
    { name: 'severity', type: 'select', label: 'Severity', required: true, order: 4,
      options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    { name: 'acknowledged', type: 'checkbox', label: 'Acknowledged', required: true, order: 5 },
    { name: 'notes', type: 'textarea', label: 'Notes', order: 6 },
    { name: 'backupVerified', type: 'yesno', label: 'Backup verified', required: true, order: 7 },
  ],
};

const validAnswers = {
  summary: 'All clusters healthy.',
  incidentCount: 2,
  checkedOn: '2025-09-15',
  severity: 'low',
  acknowledged: true,
  notes: 'No action needed.',
  backupVerified: 'yes',
};

async function createTemplate(body: object = fullTemplate): Promise<string> {
  const res = await request(app)
    .post('/api/v1/templates')
    .set(authHeader(manager))
    .send(body);
  expect(res.status).toBe(201);
  return res.body.template._id;
}

async function submitReport(
  templateId: string,
  answers: unknown = validAnswers,
  actor: SeededUser = staff
) {
  return request(app)
    .post('/api/v1/reports')
    .set(authHeader(actor))
    .field('templateId', templateId)
    .field('periodStart', '2025-09-08')
    .field('templateData', JSON.stringify(answers));
}

describe('templates', () => {
  it('only lets a manager create one', async () => {
    for (const actor of [staff, supervisor]) {
      const res = await request(app)
        .post('/api/v1/templates')
        .set(authHeader(actor))
        .send(fullTemplate);
      expect(res.status).toBe(403);
    }
  });

  it('rejects a select field with no options', async () => {
    const res = await request(app)
      .post('/api/v1/templates')
      .set(authHeader(manager))
      .send({
        ...fullTemplate,
        fields: [{ name: 'pick', type: 'select', label: 'Pick', options: [] }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate field names', async () => {
    const res = await request(app)
      .post('/api/v1/templates')
      .set(authHeader(manager))
      .send({
        ...fullTemplate,
        fields: [
          { name: 'same', type: 'text', label: 'One' },
          { name: 'same', type: 'text', label: 'Two' },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('rejects a validator pattern that is not a valid regular expression', async () => {
    const res = await request(app)
      .post('/api/v1/templates')
      .set(authHeader(manager))
      .send({
        ...fullTemplate,
        fields: [
          { name: 'code', type: 'text', label: 'Code', validators: { pattern: '([unclosed' } },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('bumps the version when the field set changes, but not for a description edit', async () => {
    const id = await createTemplate();

    const renamed = await request(app)
      .patch(`/api/v1/templates/${id}`)
      .set(authHeader(manager))
      .send({ description: 'Reworded only.' });
    expect(renamed.body.template.version).toBe(1);
    expect(renamed.body.versionBumped).toBe(false);

    const refielded = await request(app)
      .patch(`/api/v1/templates/${id}`)
      .set(authHeader(manager))
      .send({ fields: [{ name: 'onlyField', type: 'text', label: 'Only field' }] });
    expect(refielded.body.template.version).toBe(2);
    expect(refielded.body.versionBumped).toBe(true);
  });

  it('retires rather than deletes a template that reports point at', async () => {
    const id = await createTemplate();
    await submitReport(id);

    const res = await request(app).delete(`/api/v1/templates/${id}`).set(authHeader(manager));

    expect(res.status).toBe(200);
    expect(res.body.retired).toBe(true);
    // The definition must survive, or existing answers become uninterpretable.
    expect(res.body.template.isActive).toBe(false);
  });

  it('deletes a template no report references', async () => {
    const id = await createTemplate();
    const res = await request(app).delete(`/api/v1/templates/${id}`).set(authHeader(manager));

    expect(res.status).toBe(200);
    expect(res.body.retired).toBe(false);
  });

  it('hides retired templates from staff', async () => {
    const id = await createTemplate();
    await request(app)
      .patch(`/api/v1/templates/${id}`)
      .set(authHeader(manager))
      .send({ isActive: false });

    const staffView = await request(app).get('/api/v1/templates').set(authHeader(staff));
    expect(staffView.body.templates).toHaveLength(0);

    const managerView = await request(app).get('/api/v1/templates').set(authHeader(manager));
    expect(managerView.body.templates).toHaveLength(1);
  });
});

describe('report submission against a template', () => {
  it('accepts answers matching every field type', async () => {
    const id = await createTemplate();
    const res = await submitReport(id);

    expect(res.status).toBe(201);
    expect(res.body.report.reviewStatus).toBe('pending');
    expect(res.body.report.templateVersion).toBe(1);
  });

  it('records the ISO week of the period, not of the submission', async () => {
    const id = await createTemplate();
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', id)
      // A period in ISO week 1 of 2026, submitted much later.
      .field('periodStart', '2026-01-01')
      .field('templateData', JSON.stringify(validAnswers));

    expect(res.status).toBe(201);
    expect(res.body.report.isoYear).toBe(2026);
    expect(res.body.report.isoWeek).toBe(1);
  });

  it('rejects an unknown answer key instead of storing it', async () => {
    const id = await createTemplate();
    const res = await submitReport(id, { ...validAnswers, smuggled: 'payload' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it.each([
    ['a missing required answer', { ...validAnswers, summary: undefined }],
    ['a number above its maximum', { ...validAnswers, incidentCount: 500 }],
    ['a select value outside the options', { ...validAnswers, severity: 'catastrophic' }],
    ['an unticked required checkbox', { ...validAnswers, acknowledged: false }],
    ['a yesno value that is neither', { ...validAnswers, backupVerified: 'maybe' }],
    ['text shorter than its minimum', { ...validAnswers, summary: 'x' }],
  ])('rejects %s', async (_label, answers) => {
    const id = await createTemplate();
    const res = await submitReport(id, answers);
    expect(res.status).toBe(400);
  });

  it('reports which field failed', async () => {
    const id = await createTemplate();
    const res = await submitReport(id, { ...validAnswers, incidentCount: 500 });

    expect(res.body.error.details.some((d: { path: string }) => d.path === 'incidentCount')).toBe(true);
  });

  it('refuses a retired template', async () => {
    const id = await createTemplate();
    await request(app)
      .patch(`/api/v1/templates/${id}`)
      .set(authHeader(manager))
      .send({ isActive: false });

    const res = await submitReport(id);
    expect(res.status).toBe(409);
  });

  it('rejects malformed templateData JSON', async () => {
    const id = await createTemplate();
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', id)
      .field('periodStart', '2025-09-08')
      .field('templateData', '{not json');

    expect(res.status).toBe(400);
  });
});

describe('report visibility', () => {
  it('shows staff only their own reports', async () => {
    const id = await createTemplate();
    await submitReport(id, validAnswers, staff);
    await submitReport(id, validAnswers, otherStaff);

    const mine = await request(app).get('/api/v1/reports').set(authHeader(staff));
    expect(mine.body.reports).toHaveLength(1);
    expect(mine.body.reports[0].submittedBy._id).toBe(staff.id);
  });

  it('ignores a submittedBy filter from staff trying to see someone else', async () => {
    const id = await createTemplate();
    await submitReport(id, validAnswers, otherStaff);

    const res = await request(app)
      .get(`/api/v1/reports?submittedBy=${otherStaff.id}`)
      .set(authHeader(staff));

    expect(res.body.reports).toHaveLength(0);
  });

  it('shows reviewers every report', async () => {
    const id = await createTemplate();
    await submitReport(id, validAnswers, staff);
    await submitReport(id, validAnswers, otherStaff);

    for (const actor of [supervisor, manager]) {
      const res = await request(app).get('/api/v1/reports').set(authHeader(actor));
      expect(res.body.reports).toHaveLength(2);
    }
  });

  it('lets the author fetch their own report by id', async () => {
    const id = await createTemplate();
    const created = await submitReport(id, validAnswers, staff);

    const res = await request(app)
      .get(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(staff));

    // The handler populates submittedBy, so the owner check must read the id off
    // the populated document rather than stringifying it.
    expect(res.status).toBe(200);
    expect(res.body.report._id).toBe(created.body.report._id);
  });

  it('lets a reviewer fetch any report by id', async () => {
    const id = await createTemplate();
    const created = await submitReport(id, validAnswers, staff);

    for (const actor of [supervisor, manager]) {
      const res = await request(app)
        .get(`/api/v1/reports/${created.body.report._id}`)
        .set(authHeader(actor));
      expect(res.status).toBe(200);
    }
  });

  it('answers 404 when staff fetch another persons report by id', async () => {
    const id = await createTemplate();
    const created = await submitReport(id, validAnswers, otherStaff);

    const res = await request(app)
      .get(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(staff));

    // 404 rather than 403, so the response does not confirm the report exists.
    expect(res.status).toBe(404);
  });
});

describe('review lifecycle', () => {
  it('lets a supervisor approve a report', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .post(`/api/v1/reports/${created.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'approved', reviewComments: 'Looks right.' });

    expect(res.status).toBe(200);
    expect(res.body.report.reviewStatus).toBe('approved');
    expect(res.body.report.reviewedBy).toBe(supervisor.id);
  });

  it('requires a reason to reject', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .post(`/api/v1/reports/${created.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'rejected' });

    expect(res.status).toBe(400);
  });

  it('does not let staff review', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .post(`/api/v1/reports/${created.body.report._id}/review`)
      .set(authHeader(staff))
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
  });

  it('does not let a reviewer rule on their own submission', async () => {
    const id = await createTemplate();
    const own = await submitReport(id, validAnswers, supervisor);

    const res = await request(app)
      .post(`/api/v1/reports/${own.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
  });

  it('will not review the same report twice', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);
    const url = `/api/v1/reports/${created.body.report._id}/review`;

    await request(app).post(url).set(authHeader(supervisor)).send({ decision: 'approved' });
    const second = await request(app)
      .post(url)
      .set(authHeader(manager))
      .send({ decision: 'rejected', rejectionReason: 'Changed my mind' });

    expect(second.status).toBe(409);
  });
});

describe('revisions', () => {
  async function rejectedReport(): Promise<string> {
    const id = await createTemplate();
    const created = await submitReport(id);
    await request(app)
      .post(`/api/v1/reports/${created.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'rejected', rejectionReason: 'Attach the incident log' });
    return created.body.report._id;
  }

  it('links a revision back to the rejected original', async () => {
    const originalId = await rejectedReport();
    const template = await request(app).get('/api/v1/templates').set(authHeader(manager));

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', template.body.templates[0]._id)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .field('revisionOf', originalId);

    expect(res.status).toBe(201);
    expect(res.body.report.revisionOf).toBe(originalId);
  });

  it('will not revise a report that is still pending', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', id)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .field('revisionOf', created.body.report._id);

    expect(res.status).toBe(409);
  });

  it('will not revise someone elses report', async () => {
    const originalId = await rejectedReport();
    const template = await request(app).get('/api/v1/templates').set(authHeader(manager));

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(otherStaff))
      .field('templateId', template.body.templates[0]._id)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .field('revisionOf', originalId);

    expect(res.status).toBe(403);
  });

  it('will not revise the same report twice', async () => {
    const originalId = await rejectedReport();
    const template = await request(app).get('/api/v1/templates').set(authHeader(manager));
    const templateId = template.body.templates[0]._id;

    const revise = () =>
      request(app)
        .post('/api/v1/reports')
        .set(authHeader(staff))
        .field('templateId', templateId)
        .field('periodStart', '2025-09-08')
        .field('templateData', JSON.stringify(validAnswers))
        .field('revisionOf', originalId);

    expect((await revise()).status).toBe(201);
    expect((await revise()).status).toBe(409);
  });
});

describe('editing a report', () => {
  it('lets the author edit while it is still pending', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .patch(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(staff))
      .field('templateData', JSON.stringify({ ...validAnswers, incidentCount: 7 }));

    expect(res.status).toBe(200);
    expect(res.body.report.templateData.incidentCount).toBe(7);
  });

  it('refuses once the report has been reviewed', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);
    await request(app)
      .post(`/api/v1/reports/${created.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'approved' });

    const res = await request(app)
      .patch(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(staff))
      .field('templateData', JSON.stringify({ ...validAnswers, incidentCount: 7 }));

    expect(res.status).toBe(409);
  });

  it('refuses someone who is not the author', async () => {
    const id = await createTemplate();
    const created = await submitReport(id);

    const res = await request(app)
      .patch(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(otherStaff))
      .field('templateData', JSON.stringify(validAnswers));

    expect(res.status).toBe(403);
  });
});

describe('attachments', () => {
  const attach = (templateId: string, actor: SeededUser = staff) =>
    request(app)
      .post('/api/v1/reports')
      .set(authHeader(actor))
      .field('templateId', templateId)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .attach('files', Buffer.from('incident log contents'), {
        filename: 'log.txt',
        contentType: 'text/plain',
      });

  it('stores an attachment and returns it to the author', async () => {
    const templateId = await createTemplate();
    const created = await attach(templateId);
    expect(created.status).toBe(201);

    const file = await ReportFileModel.findOne({ reportId: created.body.report._id });
    expect(file).not.toBeNull();

    const download = await request(app)
      .get(`/api/v1/reports/files/${file!._id.toString()}`)
      .set(authHeader(staff));

    expect(download.status).toBe(200);
    expect(download.text).toBe('incident log contents');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
  });

  it('never uses the client filename as the stored name', async () => {
    const templateId = await createTemplate();
    const created = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', templateId)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .attach('files', Buffer.from('x'), {
        filename: '../../../etc/passwd',
        contentType: 'text/plain',
      });

    expect(created.status).toBe(201);
    const file = await ReportFileModel.findOne({ reportId: created.body.report._id });
    expect(file!.storedName).not.toContain('..');
    expect(file!.storedName).not.toContain('/');
    // The original is kept for display, stripped of any path component.
    expect(file!.originalName).toBe('passwd');
  });

  it('denies another staff member the attachment', async () => {
    const templateId = await createTemplate();
    const created = await attach(templateId);
    const file = await ReportFileModel.findOne({ reportId: created.body.report._id });

    const res = await request(app)
      .get(`/api/v1/reports/files/${file!._id.toString()}`)
      .set(authHeader(otherStaff));

    expect(res.status).toBe(404);
  });

  it('allows a reviewer the attachment', async () => {
    const templateId = await createTemplate();
    const created = await attach(templateId);
    const file = await ReportFileModel.findOne({ reportId: created.body.report._id });

    const res = await request(app)
      .get(`/api/v1/reports/files/${file!._id.toString()}`)
      .set(authHeader(supervisor));

    expect(res.status).toBe(200);
  });

  it('requires authentication', async () => {
    const templateId = await createTemplate();
    const created = await attach(templateId);
    const file = await ReportFileModel.findOne({ reportId: created.body.report._id });

    const res = await request(app).get(`/api/v1/reports/files/${file!._id.toString()}`);
    expect(res.status).toBe(401);
  });

  it('rejects a file type outside the allowlist', async () => {
    const templateId = await createTemplate();
    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', templateId)
      .field('periodStart', '2025-09-08')
      .field('templateData', JSON.stringify(validAnswers))
      .attach('files', Buffer.from('<script>alert(1)</script>'), {
        filename: 'payload.html',
        contentType: 'text/html',
      });

    expect(res.status).toBe(400);
  });

  it('leaves no orphaned file when the submission is rejected', async () => {
    const templateId = await createTemplate();

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', templateId)
      .field('periodStart', '2025-09-08')
      // Invalid answers, so the report is refused after the upload is stored.
      .field('templateData', JSON.stringify({ ...validAnswers, severity: 'nope' }))
      .attach('files', Buffer.from('orphan candidate'), {
        filename: 'log.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(await ReportFileModel.countDocuments({})).toBe(0);
  });

  it('removes attachments when a manager deletes the report', async () => {
    const templateId = await createTemplate();
    const created = await attach(templateId);
    expect(await ReportFileModel.countDocuments({})).toBe(1);

    const res = await request(app)
      .delete(`/api/v1/reports/${created.body.report._id}`)
      .set(authHeader(manager));

    expect(res.status).toBe(200);
    expect(await ReportFileModel.countDocuments({})).toBe(0);
    expect(await ReportModel.countDocuments({})).toBe(0);
  });

  it('only lets a manager delete a report', async () => {
    const templateId = await createTemplate();
    const created = await submitReport(templateId);

    for (const actor of [staff, supervisor]) {
      const res = await request(app)
        .delete(`/api/v1/reports/${created.body.report._id}`)
        .set(authHeader(actor));
      expect(res.status).toBe(403);
    }
  });
});

describe('filtering', () => {
  it('filters by ISO week', async () => {
    const id = await createTemplate();
    await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', id)
      .field('periodStart', '2026-01-01')
      .field('templateData', JSON.stringify(validAnswers));
    await request(app)
      .post('/api/v1/reports')
      .set(authHeader(staff))
      .field('templateId', id)
      .field('periodStart', '2026-03-02')
      .field('templateData', JSON.stringify(validAnswers));

    const res = await request(app)
      .get('/api/v1/reports?isoYear=2026&isoWeek=1')
      .set(authHeader(manager));

    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].isoWeek).toBe(1);
  });

  it('filters by review status', async () => {
    const id = await createTemplate();
    const first = await submitReport(id);
    await submitReport(id, validAnswers, otherStaff);
    await request(app)
      .post(`/api/v1/reports/${first.body.report._id}/review`)
      .set(authHeader(supervisor))
      .send({ decision: 'approved' });

    const pending = await request(app)
      .get('/api/v1/reports?reviewStatus=pending')
      .set(authHeader(manager));

    expect(pending.body.reports).toHaveLength(1);
  });

  it('rejects a range where from is after to', async () => {
    const res = await request(app)
      .get('/api/v1/reports?from=2026-05-01&to=2026-01-01')
      .set(authHeader(manager));

    expect(res.status).toBe(400);
  });

  it('paginates', async () => {
    const id = await createTemplate();
    for (let i = 0; i < 3; i += 1) await submitReport(id);

    const res = await request(app).get('/api/v1/reports?page=1&limit=2').set(authHeader(manager));

    expect(res.body.reports).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      totalCount: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });
});
