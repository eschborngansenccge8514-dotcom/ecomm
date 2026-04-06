'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, QrCode, CheckCircle2, XCircle, RefreshCw, 
  LogOut, MessageSquare, History, Phone, Calendar 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';

interface WhatsAppMessage {
  id: string;
  recipient_number: string;
  message_content: string;
  status: string;
  created_at: string;
}

export function WhatsAppClient({ merchant }: { merchant: any }) {
  const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const supabase = createClient();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_URL}/whatsapp/qr`);
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: text || 'Failed to fetch status' };
      }

      if (data.success) {
        if (data.status === 'connected') {
          setStatus('connected');
          setPolling(false);
        } else if (data.status === 'qr') {
          setStatus('qr');
          setQrBase64(data.base64);
          setPolling(true);
        }
      } else {
        setStatus('error');
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);
  }, [merchant.id, supabase]);

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    setStatus('loading');
    try {
      await fetch(`${WORKER_URL}/whatsapp/logout`, { method: 'POST' });
      fetchStatus();
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMessages();
  }, [fetchStatus, fetchMessages]);

  useEffect(() => {
    let interval: any;
    if (polling) {
      interval = setInterval(() => {
        fetchStatus();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-logs')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'whatsapp_messages', 
        filter: `merchant_id=eq.${merchant.id}` 
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant.id, fetchMessages, supabase]);

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
            <MessageSquare className="text-green-600" size={32} />
            WhatsApp Integration
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-lg">
            Connect your WhatsApp account and review communication history from the AI Agent.
          </p>
        </div>
        {status === 'connected' && (
          <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1.5 rounded-full flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span className="font-bold">Active Connection</span>
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-6">
              <CardTitle className="text-xl">Connection Status</CardTitle>
              <CardDescription>
                Link your WhatsApp account to enable AI messaging.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 pb-10 flex flex-col items-center justify-center min-h-[400px]">
              {status === 'loading' && (
                <div className="flex flex-col items-center gap-4 text-gray-400">
                  <Loader2 className="animate-spin" size={48} />
                  <p className="font-medium">Initializing...</p>
                </div>
              )}

              {status === 'qr' && qrBase64 && (
                <div className="flex flex-col items-center gap-8 w-full">
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                    <div className="relative bg-white p-6 rounded-[1.5rem] shadow-2xl border border-gray-100">
                      <img src={qrBase64} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                  </div>
                  <div className="max-w-xs text-center space-y-4">
                    <h3 className="font-bold text-gray-900 text-lg">Scan QR Code</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Open WhatsApp &gt; Linked Devices &gt; Link a Device.
                    </p>
                    <Button variant="outline" size="sm" onClick={fetchStatus} className="rounded-full gap-2">
                      <RefreshCw size={14} /> Refresh
                    </Button>
                  </div>
                </div>
              )}

              {status === 'connected' && (
                <div className="flex flex-col items-center gap-6 py-10">
                  <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center text-green-500 shadow-inner">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-gray-900">Connected</h3>
                    <p className="text-gray-500 max-w-sm">
                      AI Agent is ready to send messages.
                    </p>
                  </div>
                  <Button variant="destructive" className="rounded-2xl" onClick={handleLogout}>
                    Disconnect
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message History */}
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <History size={20} className="text-gray-500" />
                  Message History
                </CardTitle>
                <CardDescription>Recent messages sent by the AI agent.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchMessages} className="text-gray-400">
                <RefreshCw size={16} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMessages ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-200" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center p-10 text-gray-400">
                   <p>No messages sent yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          <Phone size={14} className="text-gray-400" />
                          {msg.recipient_number.split('@')[0]}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar size={12} />
                          {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-100/50 p-3 rounded-xl border border-gray-100 italic">
                        "{msg.message_content}"
                      </p>
                      <div className="mt-2 text-[10px] uppercase font-bold tracking-widest text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {msg.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="rounded-3xl border-none shadow-md bg-white">
            <CardHeader><CardTitle className="text-lg">Instructions</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Open WhatsApp Settings.</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Scan the QR code above.</span>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
