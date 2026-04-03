'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface MarketplaceHealth {
  total_listings: number;
  accounts: Array<{
    provider_id: string;
    status:      string;
    last_sync_at: string;
  }>;
  issues: Array<{
    type:     string;
    count:    number;
    severity: 'error' | 'warning' | 'info';
    message:  string;
  }>;
  health_score: number;
}

export function ListingHealthWidget() {
  const [data,    setData]    = useState<MarketplaceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/dashboard/marketplace/health');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    // Simulate sync
    await new Promise(r => setTimeout(r, 2000));
    setSyncing(false);
    fetchHealth();
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <Card className="rounded-2xl border-gray-100 p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="rounded-2xl border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gray-50/50">
        <CardTitle className="text-sm font-semibold tracking-tight text-gray-700 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          Marketplace Listing Health
        </CardTitle>
        <button 
          onClick={syncNow}
          disabled={syncing}
          className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-medium disabled:opacity-50"
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Overall Health Score</span>
                <span className="font-bold text-gray-900">{data.health_score}/100</span>
            </div>
            <Progress value={data.health_score} className="h-2.5 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Total Listings</p>
                <p className="text-2xl font-bold text-gray-900">{data.total_listings}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-right">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Active Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{data.accounts.filter(a => a.status === 'active').length}</p>
            </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1">Issues Found</p>
          {data.issues.map((issue, i) => (
            <div 
              key={i} 
              className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-50 shadow-sm hover:border-primary/20 transition-colors"
            >
              {issue.severity === 'error' && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />}
              {issue.severity === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />}
              {issue.severity === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
              <div>
                <p className="text-xs font-bold text-gray-800">{issue.message}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">Affects {issue.count} listings</p>
              </div>
            </div>
          ))}
          {data.issues.length === 0 && (
             <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-xl border border-green-100">
                <CheckCircle2 size={16} />
                <span className="font-medium">All listings are healthy!</span>
             </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
