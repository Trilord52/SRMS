import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, CheckCircle2, Clock, FileStack } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import {
  useAnalyticsBySubmitter,
  useAnalyticsByTemplate,
  useAnalyticsOverview,
  type AnalyticsRange,
} from '@/lib/queries';
import { fullName } from '@/lib/schemas';

/**
 * Analytics.
 *
 * The trend plots a single measure, so it needs one series colour and no legend —
 * the title names it. The status breakdown is shown as labelled tiles rather than
 * a stacked series: pending, approved, and rejected are status colours, and as a
 * categorical set they fail colourblind separation (amber against green is ΔE 3.8
 * under protanopia), so distinguishing them by fill alone would not be readable.
 */
export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>({});
  const [showTable, setShowTable] = useState(false);

  const overview = useAnalyticsOverview(range);
  const bySubmitter = useAnalyticsBySubmitter(range);
  const byTemplate = useAnalyticsByTemplate(range);

  const set = (key: keyof AnalyticsRange) => (value: string) =>
    setRange((current) => ({ ...current, [key]: value || undefined }));

  if (overview.isLoading) return <Spinner label="Loading analytics" className="p-6" />;
  if (overview.error) return <Alert tone="error">Could not load analytics. Try again.</Alert>;

  const data = overview.data;
  if (!data) return null;

  const { totals, metrics, trend } = data;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Overview</h1>

      {/* Filters sit in one row above the charts. */}
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Field label="From">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={range.from ?? ''}
                onChange={(event) => set('from')(event.target.value)}
              />
            )}
          </Field>
          <Field label="To">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={range.to ?? ''}
                onChange={(event) => set('to')(event.target.value)}
              />
            )}
          </Field>
          <Field label="Bucket size">
            {(props) => (
              <Select
                {...props}
                value={range.granularity ?? ''}
                onChange={(event) => set('granularity')(event.target.value)}
              >
                <option value="">Automatic</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </Select>
            )}
          </Field>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {new Date(data.range.from).toLocaleDateString()} to{' '}
        {new Date(data.range.to).toLocaleDateString()}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Reports" value={totals.reports} icon={FileStack} />
        <StatTile label="Pending review" value={totals.pending} icon={Clock} tone="warning" />
        <StatTile label="Approved" value={totals.approved} icon={CheckCircle2} tone="success" />
        <StatTile label="Rejected" value={totals.rejected} icon={AlertCircle} tone="danger" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Reviewed"
          value={`${metrics.reviewedSharePercent}%`}
          hint="Share of reports that reached a decision"
        />
        <StatTile
          label="Approval rate"
          // Null means nothing has been decided, which is not the same as nothing
          // approved, so it reads as "no data yet" rather than 0%.
          value={metrics.approvalRatePercent === null ? '—' : `${metrics.approvalRatePercent}%`}
          hint={
            metrics.approvalRatePercent === null
              ? 'Nothing decided yet'
              : 'Share of decided reports approved'
          }
        />
        <StatTile
          label="Average review time"
          value={
            metrics.averageReviewHours === null ? '—' : `${metrics.averageReviewHours} h`
          }
          hint={
            metrics.averageReviewHours === null
              ? 'Nothing reviewed yet'
              : 'From submission to decision'
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">Reports submitted</CardTitle>
            <CardDescription>
              Counted per {range.granularity ?? 'automatic'} bucket across the selected range.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowTable((current) => !current)}>
            {showTable ? 'Show chart' : 'Show table'}
          </Button>
        </CardHeader>

        <CardContent>
          {trend.length === 0 ? (
            <EmptyState
              title="No submissions in this range"
              description="Widen the date range to see activity."
            />
          ) : showTable ? (
            <TableWrap>
              <Table>
                <caption className="sr-only">Reports submitted per bucket</caption>
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Reports</Th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((bucket) => (
                    <tr key={bucket.start}>
                      <Td>{bucket.label}</Td>
                      <Td>{bucket.count}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    stroke="var(--chart-grid)"
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    stroke="var(--chart-grid)"
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--foreground)',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value, 'Reports']}
                  />
                  {/* Rounded data-end anchored to the baseline. */}
                  <Bar
                    dataKey="count"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By submitter</CardTitle>
        </CardHeader>
        <CardContent>
          {bySubmitter.isLoading ? (
            <Spinner label="Loading" />
          ) : (bySubmitter.data?.submitters.length ?? 0) === 0 ? (
            <EmptyState title="No submissions in this range" />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Per-submitter figures</caption>
                <thead>
                  <tr>
                    <Th>Submitter</Th>
                    <Th>Reports</Th>
                    <Th>Approved</Th>
                    <Th>Rejected</Th>
                    <Th>Pending</Th>
                    <Th>Avg review</Th>
                    <Th>Score</Th>
                  </tr>
                </thead>
                <tbody>
                  {(bySubmitter.data?.submitters ?? []).map((row) => (
                    <tr key={row.submitter._id}>
                      <Td>{fullName(row.submitter)}</Td>
                      <Td>{row.totals.reports}</Td>
                      <Td>{row.totals.approved}</Td>
                      <Td>{row.totals.rejected}</Td>
                      <Td>{row.totals.pending}</Td>
                      <Td>
                        {row.metrics.averageReviewHours === null
                          ? '—'
                          : `${row.metrics.averageReviewHours} h`}
                      </Td>
                      <Td>{row.metrics.performanceScore}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By template</CardTitle>
          <CardDescription>
            Grouped by the template a report was submitted against.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byTemplate.isLoading ? (
            <Spinner label="Loading" />
          ) : (byTemplate.data?.templates.length ?? 0) === 0 ? (
            <EmptyState title="No submissions in this range" />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Per-template figures</caption>
                <thead>
                  <tr>
                    <Th>Template</Th>
                    <Th>Reports</Th>
                    <Th>Approved</Th>
                    <Th>Rejected</Th>
                    <Th>Approval rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {(byTemplate.data?.templates ?? []).map((row) => (
                    <tr key={row.template._id}>
                      <Td>{row.template.name}</Td>
                      <Td>{row.totals.reports}</Td>
                      <Td>{row.totals.approved}</Td>
                      <Td>{row.totals.rejected}</Td>
                      <Td>
                        {row.metrics.approvalRatePercent === null
                          ? '—'
                          : `${row.metrics.approvalRatePercent}%`}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const tones = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted-foreground',
} as const;

/**
 * A single number with its label. Status is carried by the icon and the label
 * text, not by colour alone.
 */
function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof tones;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`size-4 shrink-0 ${tones[tone]}`} aria-hidden="true" />}
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
