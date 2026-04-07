import { getEmailKpis, getEmailLogs } from './_data/queries';
import { EmailLogTable } from './email-log-table';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export const metadata = { title: 'Email Logs' };

// Always fetch fresh logs in dev/production to ensure real-time visibility
export const dynamic = 'force-dynamic';

export default async function EmailDashboardPage() {
  const [kpis, logs] = await Promise.all([getEmailKpis(), getEmailLogs()]);

  const deliveryRate =
    kpis.total > 0 ? ((kpis.delivered / kpis.total) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Email Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor your transactional email delivery and health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/email/settings">
            <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-bold">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Sent',     value: kpis.total,     className: 'bg-muted/50' },
          { label: 'Delivered',      value: kpis.delivered, className: 'bg-green-500/10 text-green-700' },
          { label: 'Received',       value: kpis.received,  className: 'bg-blue-500/10 text-blue-700' },
          { label: 'Failed',         value: kpis.failed,    className: 'bg-red-500/10 text-red-700'   },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-lg border p-4 ${kpi.className}`}>
            <p className="text-xs font-medium uppercase tracking-wider opacity-70">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Overall delivery rate: <span className="font-bold text-foreground">{deliveryRate}%</span>
        </p>
      </div>

      {/* Log Table */}
      <EmailLogTable initialData={logs} />
    </div>
  );
}
