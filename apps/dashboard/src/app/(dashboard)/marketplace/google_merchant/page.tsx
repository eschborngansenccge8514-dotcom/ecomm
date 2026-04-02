import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink, Plus, RefreshCw, AlertCircle } from "lucide-react";

export default async function GoogleMerchantOverviewPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("marketplace_accounts")
    .select("*")
    .eq("provider_id", "google_merchant");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Merchant Center</h1>
          <p className="text-muted-foreground">Manage your Google Shopping feed and product diagnostics.</p>
        </div>
        <Link href="/marketplace/google_merchant/connect" className={cn(buttonVariants({}))}>
          <Plus className="mr-2 h-4 w-4" />
          Connect Account
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts?.map((account: any) => (
          <Card key={account.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {account.shop_name || "GMC Account"}
              </CardTitle>
              <Badge variant={account.status === "active" ? "default" : "destructive"}>
                {account.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{account.shop_id || "ID Pending"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Last sync: {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : "Never"}
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/marketplace/google_merchant/${account.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                  Manage
                </Link>
                <a href={`https://merchants.google.com/mc/overview?a=${account.shop_id}`} target="_blank" rel="noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}

        {!accounts?.length && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>No Accounts Connected</CardTitle>
              <CardDescription className="max-w-xs mt-2">
                Connect your Google Merchant Center account to start syncing your products to Google Shopping.
              </CardDescription>
              <Link href="/marketplace/google_merchant/connect" className={cn(buttonVariants({}), "mt-6")}>
                Connect Your First Account
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
