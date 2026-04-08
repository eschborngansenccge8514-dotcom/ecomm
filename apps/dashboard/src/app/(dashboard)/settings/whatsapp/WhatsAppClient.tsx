'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, QrCode, CheckCircle2, XCircle, RefreshCw, 
  LogOut, MessageSquare, History, Phone, Calendar,
  ArrowUpRight, ArrowDownLeft, AlertCircle, Info, Hash,
  Search, Filter
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';

interface WhatsAppMessage {
  id: string;
  recipient_number: string;
  message_content: string;
  status: string;
  created_at: string;
  direction?: 'inbound' | 'outbound';
  sender_number?: string;
  session_id?: string;
}

export function WhatsAppClient({ merchant }: { merchant: any }) {
  const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const supabase = createClient();

  const instanceName = merchant.whatsapp_instance_name

  const fetchStatus = useCallback(async () => {
    try {
      const params = instanceName ? `?instance=${encodeURIComponent(instanceName)}` : ''
      const res = await fetch(`${WORKER_URL}/whatsapp/qr${params}`);
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
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [merchant.id, supabase]);

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    setStatus('loading');
    try {
      await fetch(`${WORKER_URL}/whatsapp/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceName }),
      });
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
        event: '*', 
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

  const filteredMessages = messages.filter(msg => {
    const matchesStatus = filterStatus === 'all' || msg.status === filterStatus;
    const matchesDirection = filterDirection === 'all' || msg.direction === filterDirection;
    const matchesSearch = !searchQuery || 
      msg.recipient_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.sender_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.message_content?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesDirection && matchesSearch;
  });

  const kpis = {
    total: messages.length,
    outbound: messages.filter(m => m.direction === 'outbound' && m.status !== 'error').length,
    inbound: messages.filter(m => m.direction === 'inbound').length,
    failed: messages.filter(m => m.status === 'error').length,
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
            <MessageSquare className="text-green-600" size={32} />
            WhatsApp Integration
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-lg">
            Connect your WhatsApp account and review communication logs from the AI Agent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === 'connected' && (
            <>
              <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1.5 rounded-full flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span className="font-bold">Active Connection</span>
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-600 rounded-xl h-10 px-4 font-bold"
              >
                <LogOut size={16} className="mr-2" />
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Messages', value: kpis.total, className: 'bg-muted/50' },
          { label: 'Outbound', value: kpis.outbound, className: 'bg-green-500/10 text-green-700' },
          { label: 'Inbound', value: kpis.inbound, className: 'bg-blue-500/10 text-blue-700' },
          { label: 'Failed', value: kpis.failed, className: 'bg-red-500/10 text-red-700' },
        ].map((kpi) => (
          <Card key={kpi.label} className={`border-none shadow-sm ${kpi.className}`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider opacity-70">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 space-y-6">
          {status !== 'connected' && (
            <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-6">
                <CardTitle className="text-xl">Connection Status</CardTitle>
                <CardDescription>
                  Link your WhatsApp account to enable AI messaging.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-8 pb-10 flex flex-col items-center justify-center min-h-[300px]">
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
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" size="sm" onClick={fetchStatus} className="rounded-full gap-2">
                          <RefreshCw size={14} /> Refresh
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex flex-col items-center gap-6 py-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 shadow-inner">
                      <AlertCircle size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Connection Failed</h3>
                      <p className="text-sm text-gray-500 max-w-sm">{error || 'Unknown error occurred'}</p>
                    </div>
                    <Button onClick={fetchStatus} className="rounded-2xl">
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity Logs (Email Log Style) */}
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <History size={20} className="text-gray-500" />
                    Activity Logs
                  </CardTitle>
                  <CardDescription>Real-time communication and system logs.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input 
                      placeholder="Search messages..." 
                      className="pl-9 rounded-xl h-10" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
                    <SelectTrigger className="w-[140px] rounded-xl h-10">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="error">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDirection} onValueChange={(v) => v && setFilterDirection(v)}>
                    <SelectTrigger className="w-[140px] rounded-xl h-10">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Directions</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchMessages} className="rounded-xl h-10 w-10">
                    <RefreshCw size={16} className={loadingMessages ? "animate-spin" : ""} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMessages ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-gray-200" size={40} /></div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center p-20 text-gray-400">
                   <p className="font-medium text-lg">No messages found.</p>
                   <p className="text-sm">Try adjusting your filters or search query.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="w-[180px] font-bold">Time</TableHead>
                        <TableHead className="w-[120px] font-bold">Direction</TableHead>
                        <TableHead className="w-[200px] font-bold">Number</TableHead>
                        <TableHead className="w-[100px] font-bold">Status</TableHead>
                        <TableHead className="font-bold">Message Content</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMessages.map((msg) => (
                        <TableRow key={msg.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="text-xs font-medium text-gray-500 py-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} />
                              {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 h-5 px-2 ${
                              msg.direction === 'inbound' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                              {msg.direction === 'inbound' ? <ArrowDownLeft size={10} className="mr-1" /> : <ArrowUpRight size={10} className="mr-1" />}
                              {msg.direction || 'outbound'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-4">
                            {msg.direction === 'inbound' ? (msg.sender_number || 'Unknown') : (msg.recipient_number?.split('@')[0] || 'Unknown')}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className={`text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 ${
                              msg.status === 'sent' || msg.status === 'received' ? 'text-green-600' : 
                              msg.status === 'error' ? 'text-red-600' : 'text-amber-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                msg.status === 'sent' || msg.status === 'received' ? 'bg-green-500' : 
                                msg.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                              }`} />
                              {msg.status}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className={`text-sm max-w-md truncate ${msg.status === 'error' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {msg.message_content}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
