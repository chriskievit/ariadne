'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchTimeReport } from '@/lib/api-client';
import { SOURCES } from '@/lib/report';
import type { TimeReport } from '@/lib/report';
import type { Source } from '@/lib/types';

const SOURCE_LABELS: Record<Source, string> = {
  github_pr: 'GitHub',
  ado_workitem: 'Azure DevOps',
  adhoc: 'Ad-hoc',
};

const SOURCE_COLORS: Record<Source, string> = {
  github_pr: 'hsl(var(--chart-1))',
  ado_workitem: 'hsl(var(--chart-2))',
  adhoc: 'hsl(var(--chart-3))',
};

interface DateRange {
  start: string;
  end: string;
}

interface Props {
  initialReport: TimeReport;
  initialRange: DateRange;
  sprintRange: DateRange | null;
}

function isEmpty(report: TimeReport): boolean {
  return SOURCES.every((source) => report.totalsBySource[source] === 0);
}

export default function ReportDashboard({ initialReport, initialRange, sprintRange }: Props) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [report, setReport] = useState<TimeReport>(initialReport);
  const [rangeMessage, setRangeMessage] = useState<string | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (range.start > range.end) {
      setRangeMessage('Start date must be before end date.');
      return;
    }
    setRangeMessage(null);
    fetchTimeReport(range.start, range.end)
      .then(setReport)
      .catch(() => {
        setRangeMessage('Could not load the report for this range. Showing the last loaded data.');
      });
  }, [range.start, range.end]);

  const donutData = SOURCES.map((source) => ({
    source,
    label: SOURCE_LABELS[source],
    hours: report.totalsBySource[source],
  }));

  const empty = isEmpty(report);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div>
            <Label htmlFor="report-start">Start</Label>
            <Input
              id="report-start"
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="report-end">End</Label>
            <Input
              id="report-end"
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!sprintRange}
            onClick={() => sprintRange && setRange(sprintRange)}
          >
            Reset to current sprint
          </Button>
          {rangeMessage ? (
            <p className="w-full text-sm text-destructive">{rangeMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {empty ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No completed items with logged time in this range.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Hours by source</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="hours"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="80%"
                    label={({ label, hours }) => `${label}: ${hours.toFixed(1)}h`}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.source} fill={SOURCE_COLORS[entry.source]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Hours per day</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}h`} />
                  <Legend formatter={(value: string) => SOURCE_LABELS[value as Source]} />
                  {SOURCES.map((source) => (
                    <Bar key={source} dataKey={source} stackId="hours" fill={SOURCE_COLORS[source]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}
