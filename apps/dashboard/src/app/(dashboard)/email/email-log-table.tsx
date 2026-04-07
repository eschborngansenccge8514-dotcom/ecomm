'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, flexRender,
  type ColumnDef, type ColumnFiltersState,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { EmailLog } from './_data/queries';

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received:   'default',
  sent:       'secondary',
  delivered:  'default',
  failed:     'destructive',
  bounced:    'outline',
  complained: 'outline',
};

const COLUMNS: ColumnDef<EmailLog>[] = [
  {
    accessorKey: 'created_at',
    header: 'Time',
    cell: ({ getValue }) =>
      new Date(getValue<string>()).toLocaleString('en-MY', {
        dateStyle: 'short', timeStyle: 'short',
      }),
  },
  { accessorKey: 'template',  header: 'Template'  },
  { accessorKey: 'recipient', header: 'Recipient' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue<string>() as keyof typeof STATUS_VARIANTS;
      return <Badge variant={STATUS_VARIANTS[s] || "secondary"}>{s}</Badge>;
    },
  },
  {
    accessorKey: 'error',
    header: 'Error',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue<string>() ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'resend_id',
    header: 'Resend ID',
    cell: ({ getValue }) => (
      <code className="text-xs">{getValue<string>() ?? '—'}</code>
    ),
  },
];

export function EmailLogTable({ initialData }: { initialData: EmailLog[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const templateOptions = useMemo(
    () => Array.from(new Set(initialData.map((r) => r.template))).sort(),
    [initialData]
  );

  const table = useReactTable({
    data: initialData,
    columns: COLUMNS,
    state: { columnFilters, globalFilter },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { sorting: [{ id: 'created_at', desc: true }] },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search recipient…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-56"
        />

        <Select
          onValueChange={(v) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== 'status'),
              ...(v === 'all' ? [] : [{ id: 'status', value: v }]),
            ])
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['received', 'sent', 'delivered', 'failed', 'bounced', 'complained'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(v) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== 'template'),
              ...(v === 'all' ? [] : [{ id: 'template', value: v }]),
            ])
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templateOptions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                  No email logs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {table.getRowModel().rows.length} of {initialData.length} logs
      </p>
    </div>
  );
}
