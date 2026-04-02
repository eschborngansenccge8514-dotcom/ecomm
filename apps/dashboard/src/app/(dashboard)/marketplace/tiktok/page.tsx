"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Loader2, Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";

export default function TikTokIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the merchant ID first
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!merchant) return;

    const { data, error } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("provider_id", "tiktok")
      .eq("tenant_id", merchant.id);

    if (error) {
      toast.error("Failed to fetch TikTok accounts");
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleConnect = () => {
    window.location.href = `${window.location.pathname}/connect`;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("marketplace_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete account");
    } else {
      toast.success("Account disconnected");
      fetchAccounts();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TikTok Shop</h1>
          <p className="text-muted-foreground">
            Manage your TikTok Shop integration and sync settings.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Connect New Shop
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>No accounts connected</CardTitle>
          <CardDescription className="max-w-sm mt-2">
            Connect your TikTok Shop account to start syncing products and orders automatically.
          </CardDescription>
          <Button onClick={handleConnect} variant="outline" className="mt-6" disabled={connecting}>
            Connect Now
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {account.shop_name || "TikTok Shop"}
                </CardTitle>
                <Badge variant={account.status === "active" ? "default" : "secondary"}>
                  {account.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{account.shop_id}</div>
                <p className="text-xs text-muted-foreground">Region: {account.region}</p>
                <div className="mt-4 flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <RefreshCw className="mr-2 h-3 w-3" /> Sync
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
