"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MXRecord {
  priority: number;
  exchange: string;
  ttl: number;
}

export interface DomainResult {
  domain: string;
  hasMx: boolean;
  mxRecords: MXRecord[];
  faviconUrl: string;
  leadCount?: number;
  securityGatewayName?: string;
  securityGatewayColor?: string;
}

export interface Lead {
  email: string;
  domain: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
}

export interface ResultsTableProps {
  results: DomainResult[];
  domainLeadCounts?: Record<string, number>;
  leads?: Lead[];
}

function MXRecordsList({ records }: { records: MXRecord[] }) {
  const [expanded, setExpanded] = useState(false);

  if (records.length === 0) {
    return <span className="text-sm text-zinc-500">No MX records</span>;
  }

  const displayRecords = expanded ? records : records.slice(0, 2);
  const hasMore = records.length > 2;

  return (
    <div className="space-y-1">
      {displayRecords.map((record) => (
        <div
          className="flex items-center gap-2 text-xs"
          key={`${record.priority}-${record.exchange}`}
        >
          <Badge
            className="px-1.5 py-0 font-mono text-[10px]"
            variant="outline"
          >
            {record.priority}
          </Badge>
          <span className="max-w-[200px] truncate font-mono text-zinc-300">
            {record.exchange}
          </span>
        </div>
      ))}
      {hasMore ? (
        <button
          className="flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />+{records.length - 2} more
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

export function ResultsTable({
  results,
  domainLeadCounts = {},
  leads: _leads,
}: ResultsTableProps) {
  const [sortBy, setSortBy] = useState<"domain" | "status" | "leads">("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedResults = [...results].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "domain":
        comparison = a.domain.localeCompare(b.domain);
        break;
      case "status":
        comparison = (a.hasMx ? 1 : 0) - (b.hasMx ? 1 : 0);
        break;
      case "leads":
        comparison =
          (domainLeadCounts[a.domain] || 0) - (domainLeadCounts[b.domain] || 0);
        break;
      default:
        comparison = 0;
    }
    return sortDir === "asc" ? comparison : -comparison;
  });

  const handleSort = (column: "domain" | "status" | "leads") => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const domainsWithMx = results.filter((r) => r.hasMx).length;
  const domainsWithoutMx = results.filter((r) => !r.hasMx).length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-2xl text-emerald-400">
              {domainsWithMx}
            </p>
            <p className="text-xs text-zinc-500">Valid MX</p>
          </div>
        </div>
        <div className="h-10 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-red-500/10 p-2">
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <p className="font-bold text-2xl text-red-400">
              {domainsWithoutMx}
            </p>
            <p className="text-xs text-zinc-500">No MX</p>
          </div>
        </div>
        <div className="h-10 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-zinc-700/50 p-2">
            <Mail className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <p className="font-bold text-2xl text-zinc-300">{results.length}</p>
            <p className="text-xs text-zinc-500">Total Domains</p>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 bg-zinc-900/70 hover:bg-zinc-900/70">
              <TableHead className="w-[50px]" />
              <TableHead>
                <Button
                  className="-ml-3 text-zinc-400 hover:text-zinc-200"
                  onClick={() => handleSort("domain")}
                  size="sm"
                  variant="ghost"
                >
                  Domain
                  {sortBy === "domain" &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  className="-ml-3 text-zinc-400 hover:text-zinc-200"
                  onClick={() => handleSort("status")}
                  size="sm"
                  variant="ghost"
                >
                  MX Status
                  {sortBy === "status" &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </Button>
              </TableHead>
              <TableHead>MX Records</TableHead>
              <TableHead className="text-right">
                <Button
                  className="text-zinc-400 hover:text-zinc-200"
                  onClick={() => handleSort("leads")}
                  size="sm"
                  variant="ghost"
                >
                  Leads
                  {sortBy === "leads" &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedResults.map((result) => (
              <TableRow
                className={cn(
                  "border-zinc-800/50 transition-colors",
                  result.hasMx ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"
                )}
                key={result.domain}
              >
                <TableCell className="w-[50px]">
                  {/* biome-ignore lint/performance/noImgElement: external favicon URLs require img tag */}
                  <img
                    alt={`${result.domain} favicon`}
                    className="rounded"
                    height={20}
                    src={result.faviconUrl}
                    width={20}
                  />
                </TableCell>
                <TableCell className="font-medium text-zinc-200">
                  {result.domain}
                </TableCell>
                <TableCell>
                  {result.hasMx ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                      <XCircle className="mr-1 h-3 w-3" />
                      No MX
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <MXRecordsList records={result.mxRecords} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-zinc-400">
                    {domainLeadCounts[result.domain] || 0}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
