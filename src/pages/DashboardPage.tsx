import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getComplaints, getInspections } from '@/lib/db';
import { type Complaint, type Inspection } from '@/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { fmtDate } from '@/lib/utils';
import { FileText, ClipboardList, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
