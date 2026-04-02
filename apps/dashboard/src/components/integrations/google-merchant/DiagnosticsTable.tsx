"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

export function DiagnosticsTable({ diagnostics }: { diagnostics: any[] }) {
  if (!diagnostics.length) {
    return <p className="text-muted-foreground text-sm">No active issues found.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[100px]">Scope</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead className="w-[120px]">Servability</TableHead>
            <TableHead className="w-[120px]">Impact</TableHead>
            <TableHead className="w-[80px]">Country</TableHead>
            <TableHead className="w-[50px]">Docs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diagnostics.map((d) => (
            <TableRow key={d.id} className="border-t">
              <TableCell className="capitalize font-medium">{d.scope}</TableCell>
              <TableCell>
                <p className="font-semibold">{d.title}</p>
                {d.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.description}</p>}
                {d.attribute_name && <Badge variant="outline" className="mt-2 text-[10px] py-0">{d.attribute_name}</Badge>}
              </TableCell>
              <TableCell>
                <SeverityBadge severity={d.severity} />
              </TableCell>
              <TableCell>
                <Badge variant={d.servability === "disapproved" ? "destructive" : "outline"} className="capitalize">
                   {d.servability?.replace(/_/g, " ") || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                {d.affected_count ? `${d.affected_count} products` : `${d.scope}-level`}
              </TableCell>
              <TableCell className="uppercase">{d.country || "All"}</TableCell>
              <TableCell>
                {d.documentation_url && (
                  <a href={d.documentation_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, any> = {
    critical: { variant: "destructive", icon: AlertTriangle },
    error: { variant: "destructive", icon: AlertCircle },
    warning: { variant: "secondary", icon: AlertTriangle },
    suggestion: { variant: "outline", icon: HelpCircle }
  };
  const config = map[severity.toLowerCase()] || map.suggestion;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1 flex justify-center w-full">
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}
