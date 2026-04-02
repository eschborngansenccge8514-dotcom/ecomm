"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

export function SyncJobTable({ jobs }: { jobs: any[] }) {
  if (!jobs.length) {
    return <p className="text-muted-foreground text-sm">No recent sync activity.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Job Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Finished At</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className="border-t">
              <TableCell className="font-medium capitalize">
                {job.job_type?.replace(/_/g, " ")}
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-xs">
                {job.started_at ? new Date(job.started_at).toLocaleString() : "-"}
              </TableCell>
              <TableCell className="text-xs">
                {job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                {job.error_message || "Success"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
    failed: { variant: "destructive", icon: XCircle, label: "Failed" },
    processing: { variant: "secondary", icon: Loader2, label: "Processing" },
    pending: { variant: "outline", icon: Clock, label: "Pending" }
  };
  const config = map[status.toLowerCase()] || map.pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1 flex justify-center w-full">
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
