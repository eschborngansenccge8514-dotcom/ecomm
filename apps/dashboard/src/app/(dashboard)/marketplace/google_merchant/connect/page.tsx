"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Globe, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleMerchantConnectPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch merchant id
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (!merchant) throw new Error("Merchant profile not found");

      // Call the Edge Function to start OAuth
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-merchant-auth-start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            tenantId: merchant.id,
            returnTo: window.location.origin + "/marketplace/google_merchant"
          })
        }
      );

      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error(data.error || "Failed to get authorization URL");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card className="border-2 border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit">
            <Globe className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Connect Google Merchant Center</CardTitle>
            <CardDescription>
              Sync your products to Google Shopping, Ads, and search results.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-3">
             <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
               <AlertCircle className="h-4 w-4" />
               Prerequisites
             </h4>
             <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground ml-2">
               <li>A verified Google Merchant Center account</li>
               <li>Enabled Content API (v2.1 or newer)</li>
               <li>Primary product feed set to "Content API"</li>
             </ul>
          </div>

          <div className="space-y-4 pt-4 border-t">
             <div className="flex items-start gap-4">
               <div className="bg-primary/10 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</div>
               <div className="space-y-1">
                 <p className="font-medium">Link Google Account</p>
                 <p className="text-sm text-muted-foreground">Authorize our platform to access your Merchant Center catalog.</p>
               </div>
             </div>
             <div className="flex items-start gap-4">
                <div className="bg-primary/10 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div className="space-y-1">
                  <p className="font-medium">Map Merchant ID</p>
                  <p className="text-sm text-muted-foreground">Select the specific Merchant ID you want to sync.</p>
                </div>
             </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border-destructive/20 border p-3 rounded-md text-sm text-destructive flex gap-3">
               <AlertCircle className="h-4 w-4 mt-0.5" />
               <p>{error}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleConnect} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Connect with Google
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
      
      <p className="text-center text-xs text-muted-foreground mt-6">
        By connecting, you agree to our Marketplace Terms of Service and authorize product data synchronization with Google.
      </p>
    </div>
  );
}
