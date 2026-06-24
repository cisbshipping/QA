import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getComplaints, getInspections } from '@/lib/db';
import { type Complaint, type Inspection } from '@/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { fmtDate } from '@/lib/utils';
import { FileText, ClipboardList, AlertCircle, CheckCircle2, Clock, TrendingUp, AlertTriangle, XCircle, CalendarCheck, Timer } from 'lucide-react';
import { differenceInDays, differenceInBusinessDays, startOfMonth, endOfMonth, subMonths, format, isSameMonth, isWithinInterval } from 'date-fns';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  to: string;
}

function StatCard({ label, value, icon, color, to }: StatCardProps) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow">
        <CardBody className="flex items-center gap-4 py-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { appUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getComplaints(), getInspections()])
      .then(([c, i]) => { setComplaints(c); setInspections(i); })
      .finally(() => setLoading(false));
  }, []);

  const openComplaints = complaints.filter(c => c.status === 'open').length;
  const pendingInspections = inspections.filter(i => i.status === 'pending').length;
  const closedComplaints = complaints.filter(c => c.status === 'closed').length;
  const passedInspections = inspections.filter(i => i.status === 'passed').length;

  const recentComplaints = complaints.slice(0, 5);
  const recentInspections = inspections.slice(0, 5);

  // ---- Period selector (which month/range to compute KPIs for) ----
  const [periodKey, setPeriodKey] = useState<string>('current'); // 'current' | 'last' | 'all' | 'YYYY-MM'
  const period = useMemo(() => {
    const now = new Date();
    if (periodKey === 'all') {
      return { label: 'All time', start: null as Date | null, end: null as Date | null };
    }
    if (periodKey === 'current') {
      return { label: format(now, 'MMMM yyyy'), start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (periodKey === 'last') {
      const d = subMonths(now, 1);
      return { label: format(d, 'MMMM yyyy'), start: startOfMonth(d), end: endOfMonth(d) };
    }
    // 'YYYY-MM'
    const [y, m] = periodKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return { label: format(d, 'MMMM yyyy'), start: startOfMonth(d), end: endOfMonth(d) };
  }, [periodKey]);

  const isInPeriod = (date: Date | undefined | null) => {
    if (!date) return false;
    if (!period.start || !period.end) return true; // all time
    return isWithinInterval(date, { start: period.start, end: period.end });
  };

  const periodOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'current', label: 'This month' },
      { value: 'last', label: 'Last month' },
    ];
    const now = new Date();
    for (let i = 2; i <= 11; i++) {
      const d = subMonths(now, i);
      opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') });
    }
    opts.push({ value: 'all', label: 'All time' });
    return opts;
  }, []);

  // ---- Performance KPIs (filtered by period) ----
  const kpis = useMemo(() => {
    // Inspection reject rate: rejected / (reviewed), scoped to inspections REQUESTED within the period.
    const periodInspections = inspections.filter(i => isInPeriod(i.dateRequested));
    const reviewedInspections = periodInspections.filter(i => i.status !== 'pending');
    const rejectedInspections = periodInspections.filter(i => i.status === 'rejected');
    const rejectRate = reviewedInspections.length === 0
      ? null
      : (rejectedInspections.length / reviewedInspections.length) * 100;

    // Inspection date within 5 days of cargo ready date. Scope: inspections with a scheduled date IN the period.
    const inspWithBothDates = inspections.filter(i => {
      const d = i.rescheduledDate ?? i.inspectionDate;
      return d && i.factoryCommitDate && isInPeriod(d);
    });
    const onTimeInspections = inspWithBothDates.filter(i => {
      const inspDate = i.rescheduledDate ?? i.inspectionDate!;
      const days = differenceInDays(i.factoryCommitDate, inspDate);
      return days >= 0 && days <= 5;
    });
    const onTimeRate = inspWithBothDates.length === 0
      ? null
      : (onTimeInspections.length / inspWithBothDates.length) * 100;

    // Complaint close-out within 14 working days. Scope: complaints CLOSED in the period.
    const closedComplaintsList = complaints.filter(c =>
      c.status === 'closed' && c.closedAt && c.dateRecorded && isInPeriod(c.closedAt));
    const closedWithin14 = closedComplaintsList.filter(c => {
      const businessDays = differenceInBusinessDays(c.closedAt!, c.dateRecorded);
      return businessDays >= 0 && businessDays <= 14;
    });
    const closeOnTimeRate = closedComplaintsList.length === 0
      ? null
      : (closedWithin14.length / closedComplaintsList.length) * 100;

    return {
      rejectRate, rejectedCount: rejectedInspections.length, reviewedCount: reviewedInspections.length,
      onTimeRate, onTimeCount: onTimeInspections.length, withDatesCount: inspWithBothDates.length,
      closeOnTimeRate, closeOnTimeCount: closedWithin14.length, closedCount: closedComplaintsList.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints, inspections, periodKey]);

  // Approaching inspections — accepted with commit/inspection date within 3 days
  const upcoming = useMemo(() => {
    const now = new Date();
    return inspections
      .filter(i => i.status === 'accepted' || i.status === 'rescheduled')
      .map(i => {
        const date = i.rescheduledDate ?? i.inspectionDate ?? i.factoryCommitDate;
        return { i, daysOut: differenceInDays(date, now), date };
      })
      .filter(x => x.daysOut >= 0 && x.daysOut <= 3)
      .sort((a, b) => a.daysOut - b.daysOut);
  }, [inspections]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {appUser?.name}.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Upcoming inspections alert */}
          {upcoming.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="font-semibold text-sm">
                    {upcoming.length} inspection{upcoming.length > 1 ? 's' : ''} approaching (within 3 days)
                  </p>
                </div>
                <ul className="flex flex-col gap-1 ml-7">
                  {upcoming.slice(0, 5).map(({ i, daysOut, date }) => (
                    <li key={i.id} className="text-sm text-amber-900">
                      <Link to={`/inspections/${i.id}`} className="hover:underline">
                        <span className="font-mono font-medium">{i.customerPiNo}</span>
                        {' · '}{i.factory}
                        {' — '}
                        <span className="font-medium">
                          {daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`}
                        </span>
                        {' ('}{fmtDate(date)}{')'}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Complaints" value={openComplaints} to="/complaints?status=open"
              icon={<AlertCircle className="w-6 h-6 text-blue-600" />} color="bg-blue-50" />
            <StatCard label="Pending Inspections" value={pendingInspections} to="/inspections?status=pending"
              icon={<Clock className="w-6 h-6 text-yellow-600" />} color="bg-yellow-50" />
            <StatCard label="Closed Complaints" value={closedComplaints} to="/complaints?status=closed"
              icon={<CheckCircle2 className="w-6 h-6 text-green-600" />} color="bg-green-50" />
            <StatCard label="Passed Inspections" value={passedInspections} to="/inspections?status=passed"
              icon={<TrendingUp className="w-6 h-6 text-purple-600" />} color="bg-purple-50" />
          </div>

          {/* Performance KPIs */}
          <section aria-labelledby="metrics-heading">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h2 id="metrics-heading" className="text-base font-semibold text-gray-900">Performance Metrics</h2>
                <p className="text-xs text-gray-500 mt-0.5">Showing data for <span className="font-medium text-gray-700">{period.label}</span></p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label htmlFor="period-select" className="text-xs text-gray-500 whitespace-nowrap">Period</label>
                <select
                  id="period-select"
                  value={periodKey}
                  onChange={e => setPeriodKey(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] min-w-[150px]"
                >
                  {periodOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <KpiCard
                title="Inspection Reject Rate"
                target="Target ≥ 50%"
                value={kpis.rejectRate}
                subtitle={kpis.rejectRate === null
                  ? 'No reviewed inspections this period'
                  : `${kpis.rejectedCount} rejected of ${kpis.reviewedCount} reviewed`}
                icon={<XCircle className="w-5 h-5" />}
                green={50} amber={30}
              />
              <KpiCard
                title="Inspection Within 5 Days of Cargo Ready"
                target="Target ≥ 80%"
                value={kpis.onTimeRate}
                subtitle={kpis.onTimeRate === null
                  ? 'No inspections scheduled this period'
                  : `${kpis.onTimeCount} of ${kpis.withDatesCount} inspections`}
                icon={<CalendarCheck className="w-5 h-5" />}
                green={80} amber={60}
              />
              <KpiCard
                title="Complaint Closed Within 14 Working Days"
                target="Target ≥ 70%"
                value={kpis.closeOnTimeRate}
                subtitle={kpis.closeOnTimeRate === null
                  ? 'No closed complaints this period'
                  : `${kpis.closeOnTimeCount} of ${kpis.closedCount} complaints`}
                icon={<Timer className="w-5 h-5" />}
                green={70} amber={50}
              />
            </div>
          </section>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComplaintsTrendChart complaints={complaints} />
            <TopFactoriesChart complaints={complaints} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Complaints */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h2 className="text-base font-semibold text-gray-900">Recent Complaints</h2>
                </div>
                <Link to="/complaints" className="text-sm text-blue-600 hover:underline">View all</Link>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {recentComplaints.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-500">No complaints yet</div>
                ) : recentComplaints.map(c => (
                  <Link key={c.id} to={`/complaints/${c.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.complaintNo}</p>
                      <p className="text-xs text-gray-500">{c.consignee} · {fmtDate(c.dateRecorded)}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            </Card>

            {/* Recent Inspections */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-500" />
                  <h2 className="text-base font-semibold text-gray-900">Recent Inspections</h2>
                </div>
                <Link to="/inspections" className="text-sm text-blue-600 hover:underline">View all</Link>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {recentInspections.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-500">No inspections yet</div>
                ) : recentInspections.map(i => (
                  <Link key={i.id} to={`/inspections/${i.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{i.customerPiNo}</p>
                      <p className="text-xs text-gray-500">{i.customer} · {i.factory} · {fmtDate(i.dateRequested)}</p>
                    </div>
                    <StatusBadge status={i.status} />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== KPI card ==============

interface KpiCardProps {
  title: string;
  target: string; // e.g. "Target ≥ 80%"
  value: number | null; // 0-100 percentage, or null when no data
  subtitle: string;
  icon: React.ReactNode;
  green: number; // ≥ green = good
  amber: number; // ≥ amber = ok; below = bad
}

function KpiCard({ title, target, value, subtitle, icon, green, amber }: KpiCardProps) {
  let status: 'good' | 'warn' | 'bad' | 'none' = 'none';
  if (value !== null) {
    if (value >= green) status = 'good';
    else if (value >= amber) status = 'warn';
    else status = 'bad';
  }

  const styles = {
    none: { ring: 'border-gray-200', text: 'text-gray-400', bg: 'bg-gray-50', iconColor: 'text-gray-400', bar: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500' },
    good: { ring: 'border-green-200', text: 'text-green-700', bg: 'bg-green-50', iconColor: 'text-green-600', bar: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
    warn: { ring: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50', iconColor: 'text-amber-600', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
    bad:  { ring: 'border-red-200',   text: 'text-red-700',   bg: 'bg-red-50',   iconColor: 'text-red-600',   bar: 'bg-red-500',   badge: 'bg-red-100 text-red-800' },
  }[status];

  const statusLabel = { good: 'On target', warn: 'Below target', bad: 'Off target', none: 'No data' }[status];

  return (
    <Card className={`${styles.ring} hover:shadow-md transition-shadow`}>
      <CardBody className="flex flex-col gap-3 py-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{target}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${styles.bg} ${styles.iconColor}`} aria-hidden>
            {icon}
          </div>
        </div>

        {/* Value + status */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className={`text-4xl font-bold tracking-tight tabular-nums ${styles.text}`} aria-label={`${title}: ${value === null ? 'no data' : value.toFixed(0) + ' percent'}`}>
            {value === null ? '—' : `${value.toFixed(0)}%`}
          </p>
          {value !== null && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Progress bar with target marker */}
        {value !== null && (
          <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
            <div
              className={`h-full rounded-full transition-all ${styles.bar}`}
              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
            />
            {/* Target tick */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gray-700"
              style={{ left: `${green}%` }}
              title={`Target: ${green}%`}
              aria-hidden
            />
          </div>
        )}

        {/* Subtitle */}
        <p className="text-xs text-gray-500 leading-relaxed">{subtitle}</p>
      </CardBody>
    </Card>
  );
}

// ============== Charts ==============

function ComplaintsTrendChart({ complaints }: { complaints: Complaint[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const months: { label: string; date: Date; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({ label: format(d, 'MMM'), date: d, count: 0 });
    }
    for (const c of complaints) {
      for (const m of months) {
        if (isSameMonth(c.dateRecorded, m.date)) { m.count++; break; }
      }
    }
    return months;
  }, [complaints]);

  const max = Math.max(1, ...data.map(d => d.count));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">Complaints (last 6 months)</h2>
      </CardHeader>
      <CardBody>
        {data.every(d => d.count === 0) ? (
          <p className="text-sm text-gray-500 text-center py-8">No data yet</p>
        ) : (
          <div className="flex items-end justify-between gap-2 h-40">
            {data.map(d => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs font-medium text-gray-700">{d.count}</div>
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                  title={`${d.label}: ${d.count}`}
                />
                <div className="text-xs text-gray-500">{d.label}</div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TopFactoriesChart({ complaints }: { complaints: Complaint[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      if (!c.factory) continue;
      counts.set(c.factory, (counts.get(c.factory) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [complaints]);

  const max = Math.max(1, ...data.map(d => d.count));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">Top factories by complaints</h2>
      </CardHeader>
      <CardBody>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No data yet</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-900 truncate">{d.name}</span>
                  <span className="font-medium text-gray-700">{d.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
