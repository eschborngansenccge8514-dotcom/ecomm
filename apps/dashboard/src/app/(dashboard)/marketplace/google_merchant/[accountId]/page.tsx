import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { DiagnosticsTable } from "@/components/integrations/google-merchant/DiagnosticsTable";
import { SyncJobTable } from "@/components/integrations/google-merchant/SyncJobTable";

export default async function GoogleMerchantAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("marketplace_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  const { data: diagnostics } = await supabase
    .from("google_merchant_diagnostics")
    .select("*")
    .eq("account_id", accountId)
    .is("resolved_at", null)
    .order("severity", { ascending: false })
    .limit(10);

  const { data: recentJobs } = await supabase
    .from("marketplace_sync_jobs")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!account) return <div>Account not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{account.shop_name || "Merchant Center"}</h1>
            <Badge variant={account.status === "active" ? "default" : "destructive"}>{account.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">GMC ID: {account.shop_id || "Unknown"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`https://merchants.google.com/mc/overview?a=${account.shop_id}`} target="_blank" rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Merchant Center
          </a>
          <Button>
             <RefreshCw className="mr-2 h-4 w-4" />
             Sync Products
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Issues" value={diagnostics?.length || 0} icon={AlertTriangle} color="text-destructive" />
        <StatCard title="Last Check" value={account.last_sync_at ? new Date(account.last_sync_at).toLocaleDateString() : "Never"} icon={History} />
        <StatCard title="Status" value={account.status} icon={account.status === "active" ? CheckCircle2 : AlertTriangle} color={account.status === "active" ? "text-primary" : "text-destructive"} />
        <StatCard title="Provider" value="Google Merchant" icon={RefreshCw} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="jobs">Sync History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6 mt-6">
           <Card>
             <CardHeader>
               <CardTitle>Recent Critical Issues</CardTitle>
               <CardDescription>Major account or item-level problems requiring attention.</CardDescription>
             </CardHeader>
             <CardContent>
                <DiagnosticsTable diagnostics={diagnostics ?? []} />
                {(diagnostics?.length ?? 0) > 0 && (
                  <Link href={`/marketplace/google_merchant/${accountId}/feed`}
                    className={cn(buttonVariants({ variant: "link" }), "mt-4 p-0")}>
                    View all feed issues
                  </Link>
                )}
             </CardContent>
           </Card>
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-6">
          <Card>
             <CardHeader>
               <CardTitle>Active Diagnostics</CardTitle>
               <CardDescription>Product-level disapprovals and warnings.</CardDescription>
             </CardHeader>
             <CardContent>
               <DiagnosticsTable diagnostics={diagnostics ?? []} />
             </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="jobs" className="mt-6">
          <Card>
             <CardHeader>
               <CardTitle>Sync Jobs</CardTitle>
               <CardDescription>History of product and diagnostics sync operations.</CardDescription>
             </CardHeader>
             <CardContent>
               <SyncJobTable jobs={recentJobs ?? []} />
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
