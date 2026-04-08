'use client'
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function TikTokAccountDetail() {
  const { accountId } = useParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchAccount();
  }, [accountId]);

  const fetchAccount = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (error) {
      toast.error("Failed to fetch account details");
    } else {
      setAccount(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account) {
    return <div>Account not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{account.shop_name}</h1>
          <p className="text-muted-foreground">TikTok Shop Management</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Sync Now
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connection Status</span>
              <Badge variant={account.status === "active" ? "default" : "destructive"}>
                {account.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shop ID</span>
              <span className="font-mono text-sm">{account.shop_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Region</span>
              <span>{account.region}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Synced</span>
              <span className="text-sm">
                {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : "Never"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Product Sync Active</span>
            </div>
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Order Sync Active</span>
            </div>
            <div className="flex items-center space-x-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Webhook: Pending Verification</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
