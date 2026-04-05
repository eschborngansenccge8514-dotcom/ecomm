import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export default async function FeedHealthPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const supabase = await createClient();

  const { data: mappings } = await supabase
    .from("marketplace_product_mappings")
    .select("*, products(name, price, sku)")
    .eq("account_id", accountId)
    .order("last_synced_at", { ascending: false });

  const stats = mappings?.reduce((acc: any, m: any) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, { synced: 0, pending: 0, failed: 0, deleted: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Feed Health</h1>
          <p className="text-muted-foreground mt-1">Detailed status and mappings for your GMC products.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search SKU or Name..." className="w-[300px]" />
          <Button variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatusSummary title="Synced" count={stats.synced} icon={CheckCircle2} color="text-primary" />
        <StatusSummary title="Pending" count={stats.pending} icon={Search} color="text-muted-foreground" />
        <StatusSummary title="Issues" count={stats.failed} icon={AlertTriangle} color="text-warning" />
        <StatusSummary title="Deleted" count={stats.deleted} icon={XCircle} color="text-destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mappings</CardTitle>
          <CardDescription>Direct link between internal products and Google Merchant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>GMC Offer ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Synced At</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings?.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.products?.name || "Deleted Product"}</TableCell>
                  <TableCell className="text-xs font-mono">{m.products?.sku || m.external_product_id}</TableCell>
                  <TableCell className="text-xs font-mono">{m.external_product_id}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "synced" ? "default" : "secondary"} className="capitalize">
                       {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>
                     <Button variant="ghost" size="icon">
                       <ChevronRight className="h-4 w-4" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!mappings?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No product mappings found for this account.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusSummary({ title, count, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-20`} />
        </div>
      </CardContent>
    </Card>
  );
}
