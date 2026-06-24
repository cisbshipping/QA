import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getComplaints, getInspections } from '@/lib/db';
import { type Complaint, type Inspection } from '@/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { fmtDate } from '@/lib/utils';
import { FileText, ClipboardList, AlertCircle, CheckCircle2, Clock, TrendingUp, AlertTriangle, XCircle, CalendarCheck, Timer } from 'lucide-react';
import { differenceInDays, differenceInBusinessDays, startOfMonth, subMonths, format, isSameMonth } from 'date-fns';

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

  // ---- Performance KPIs ----
  const kpis = useMemo(() => {
    // Inspection reject rate: rejected / (all reviewed, i.e. not pending)
    const reviewedInspections = inspections.filter(i => i.status !== 'pending');
    const rejectedInspections = inspections.filter(i => i.status === 'rejected');
    const rejectRate = reviewedInspections.length === 0
      ? null
      : (rejectedInspections.length / reviewedInspections.length) * 100;

    // Inspection date within 5 days of cargo (factory) ready date.
    // Count inspections that have BOTH inspectionDate and factoryCommitDate set,
    // and where 0 <= (commit - inspection) <= 5 days (i.e. inspection happens within the 5 days leading up to ready date).
    const inspWithBothDates = inspections.filter(i => i.inspectionDate && i.factoryCommitDate);
    const onTimeInspections = inspWithBothDates.filter(i => {
      const inspDate = i.rescheduledDate ?? i.inspectionDate!;
      const days = differenceInDays(i.factoryCommitDate, inspDate);
      return days >= 0 && days <= 5;
    });
    const onTimeRate = inspWithBothDates.length === 0
      ? null
      : (onTimeInspections.length / inspWithBothDates.length) * 100;

    // Complaint close-out within 14 working days.
    const closedComplaintsList = complaints.filter(c => c.status === 'closed' && c.closedAt && c.dateRecorded);
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
  }, [complaints, inspections]);

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
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Performance Metrics</h2>
              <p className="text-xs text-gray-500">Lower reject rate is better · higher on-time rate is better</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiCard
                title="Inspection Reject Rate"
                value={kpis.rejectRate}
                subtitle={kpis.rejectRate === null
                  ? 'No reviewed inspections yet'
                  : `${kpis.rejectedCount} rejected of ${kpis.reviewedCount} reviewed`}
                icon={<XCircle className="w-5 h-5" />}
                lowerIsBetter
                green={10} amber={20}
              />
              <KpiCard
                title="Inspection Within 5 Days of Cargo Ready"
                value={kpis.onTimeRate}
                subtitle={kpis.onTimeRate === null
                  ? 'No inspections with both dates set yet'
                  : `${kpis.onTimeCount} of ${kpis.withDatesCount} inspections`}
                icon={<CalendarCheck className="w-5 h-5" />}
                green={80} amber={60}
              />
              <KpiCard
                title="Complaint Closed Within 14 Working Days"
                value={kpis.closeOnTimeRate}
                subtitle={kpis.closeOnTimeRate === null
                  ? 'No closed complaints yet'
                  : `${kpis.closeOnTimeCount} of ${kpis.closedCount} closed complaints`}
                icon={<Timer className="w-5 h-5" />}
                green={80} amber={60}
              />
            </div>
          </div>

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
  value: number | null; // 0-100 percentage, or null when no data
  subtitle: string;
  icon: React.ReactNode;
  green: number; // threshold for green (>= green is good unless lowerIsBetter)
  amber: number; // threshold for amber
  lowerIsBetter?: boolean;
}

function KpiCard({ title, value, subtitle, icon, green, amber, lowerIsBetter }: KpiCardProps) {
  let status: 'good' | 'warn' | 'bad' | 'none' = 'none';
  if (value !== null) {
    if (lowerIsBetter) {
      // For reject rate: smaller = good
      if (value <= green) status = 'good';
      else if (value <= amber) status = 'warn';
      else status = 'bad';
    } else {
      // For on-time rates: larger = good
      if (value >= green) status = 'good';
      else if (value >= amber) status = 'warn';
      else status = 'bad';
    }
  }

  const styles = {
    none: { ring: 'border-gray-200', text: 'text-gray-400', bg: 'bg-gray-50', iconColor: 'text-gray-400' },
    good: { ring: 'border-green-200', text: 'text-green-700', bg: 'bg-green-50', iconColor: 'text-green-600' },
    warn: { ring: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
    bad:  { ring: 'border-red-200',   text: 'text-red-700',   bg: 'bg-red-50',   iconColor: 'text-red-600' },
  }[status];

  return (
    <Card className={styles.ring}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{title}</p>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${styles.bg} ${styles.iconColor}`}>
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-bold ${styles.text}`}>
            {value === null ? '—' : `${value.toFixed(0)}%`}
          </p>
        </div>
        <p className="text-xs text-gray-500">{subtitle}</p>
        {/* Progress bar */}
        {value !== null && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all ${
                status === 'good' ? 'bg-green-500' :
                status === 'warn' ? 'bg-amber-500' :
                status === 'bad'  ? 'bg-red-500' : 'bg-gray-300'
              }`}
              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
            />
          </div>
        )}
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
