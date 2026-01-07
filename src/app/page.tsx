"use client";

import {
  BarChart3,
  Download,
  Mail,
  RefreshCw,
  Shield,
  Table2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { EmailAnalytics } from "@/components/email-analytics";
import { ProgressIndicator } from "@/components/progress-indicator";
import {
  type DomainResult,
  type Lead,
  ResultsTable,
} from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { cn } from "@/lib/utils";

interface UploadResponse {
  success: boolean;
  uploadId: string;
  totalRows: number;
  processedRows: number;
  uniqueDomains: string[];
}

interface LeadsResponse {
  success: boolean;
  leads: Lead[];
  domainCounts: Record<string, number>;
  totalLeads: number;
}

interface ProgressEvent {
  type: "progress";
  completed: number;
  total: number;
  percent: number;
  currentDomain: string;
  hasMx: boolean;
  domainsWithMx: number;
  domainsWithoutMx: number;
  domainsWithGateway: number;
  securityGateway: string | null;
}

interface CompleteEvent {
  type: "complete";
  success: boolean;
  totalDomains: number;
  domainsWithMx: number;
  domainsWithoutMx: number;
  domainsWithGateway: number;
  gatewayStats: Record<string, number>;
  results: DomainResult[];
}

interface ErrorEvent {
  type: "error";
  error: string;
}

type SSEEvent = ProgressEvent | CompleteEvent | ErrorEvent;

type Stage = "idle" | "uploading" | "parsing" | "scanning" | "complete";
type ResultsView = "analytics" | "table";

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [domainLeadCounts, setDomainLeadCounts] = useState<
    Record<string, number>
  >({});
  const [uploadStats, setUploadStats] = useState<{
    totalRows: number;
    processedRows: number;
  } | null>(null);
  const [resultsView, setResultsView] = useState<ResultsView>("analytics");

  // Live scanning stats
  const [scanStats, setScanStats] = useState({
    totalDomains: 0,
    scannedDomains: 0,
    domainsWithMx: 0,
    domainsWithoutMx: 0,
    domainsWithGateway: 0,
    currentDomain: "",
    recentResults: [] as Array<{
      domain: string;
      hasMx: boolean;
      securityGateway?: string | null;
    }>,
  });

  const handleUpload = async (file: File) => {
    setStage("uploading");
    setProgress(10);
    setResults([]);
    setLeads([]);
    setScanStats({
      totalDomains: 0,
      scannedDomains: 0,
      domainsWithMx: 0,
      domainsWithoutMx: 0,
      domainsWithGateway: 0,
      currentDomain: "",
      recentResults: [],
    });

    try {
      // Upload and parse CSV
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);
      setStage("parsing");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || "Upload failed");
      }

      const uploadData: UploadResponse = await uploadRes.json();

      setUploadStats({
        totalRows: uploadData.totalRows,
        processedRows: uploadData.processedRows,
      });

      // Fetch leads data
      const leadsRes = await fetch(
        `/api/leads?uploadId=${uploadData.uploadId}`
      );
      let leadCounts: Record<string, number> = {};
      let fetchedLeads: Lead[] = [];
      if (leadsRes.ok) {
        const leadsData: LeadsResponse = await leadsRes.json();
        leadCounts = leadsData.domainCounts;
        fetchedLeads = leadsData.leads;
      }
      setDomainLeadCounts(leadCounts);
      setLeads(fetchedLeads);

      setProgress(0);
      setStage("scanning");
      setScanStats((prev) => ({
        ...prev,
        totalDomains: uploadData.uniqueDomains.length,
      }));

      // Use streaming MX scan with SSE for real-time progress
      const scanRes = await fetch("/api/scan-mx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domains: uploadData.uniqueDomains,
          stream: true,
        }),
      });

      if (!scanRes.ok) {
        throw new Error("MX scan failed");
      }

      const reader = scanRes.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: SSEEvent = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                setProgress(data.percent);
                setScanStats((prev) => ({
                  ...prev,
                  scannedDomains: data.completed,
                  domainsWithMx: data.domainsWithMx,
                  domainsWithoutMx: data.domainsWithoutMx,
                  domainsWithGateway: data.domainsWithGateway,
                  currentDomain: data.currentDomain,
                  recentResults: [
                    ...prev.recentResults.slice(-10),
                    {
                      domain: data.currentDomain,
                      hasMx: data.hasMx,
                      securityGateway: data.securityGateway,
                    },
                  ],
                }));
              } else if (data.type === "complete") {
                setProgress(100);
                setStage("complete");
                setResults(data.results);

                toast.success(`Scanned ${data.totalDomains} domains`, {
                  description: `${data.domainsWithMx} valid MX, ${data.domainsWithGateway} with security gateways`,
                });
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("Parse error:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error processing file", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
      setStage("idle");
      setProgress(0);
    }
  };

  const handleReset = () => {
    setStage("idle");
    setProgress(0);
    setResults([]);
    setLeads([]);
    setDomainLeadCounts({});
    setUploadStats(null);
    setScanStats({
      totalDomains: 0,
      scannedDomains: 0,
      domainsWithMx: 0,
      domainsWithoutMx: 0,
      domainsWithGateway: 0,
      currentDomain: "",
      recentResults: [],
    });
  };

  const handleExport = () => {
    if (leads.length === 0 && results.length === 0) return;

    // Build a map of domain -> MX result for quick lookup
    const domainMap = new Map(results.map((r) => [r.domain, r]));

    const csvContent = [
      [
        "Email",
        "First Name",
        "Last Name",
        "Company",
        "Title",
        "Domain",
        "Has MX",
        "Security Gateway",
        "MX Records",
      ].join(","),
      ...leads.map((lead) => {
        const domainResult = domainMap.get(lead.domain);
        return [
          lead.email,
          lead.firstName || "",
          lead.lastName || "",
          `"${(lead.company || "").replace(/"/g, '""')}"`,
          `"${(lead.title || "").replace(/"/g, '""')}"`,
          lead.domain,
          domainResult?.hasMx ? "Yes" : "No",
          domainResult?.securityGatewayName || "None",
          `"${(domainResult?.mxRecords || []).map((mx) => `${mx.priority} ${mx.exchange}`).join("; ")}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mx-scan-results-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="dark min-h-screen bg-[#0a0a0a]">
      <Toaster position="top-right" theme="dark" />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient - Cymate style blue glow */}
        <div className="absolute inset-0 bg-linear-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#0a0a0a]" />
        <div className="absolute top-0 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[#0000EE]/8 blur-[120px]" />
        <div className="absolute top-20 left-1/4 h-[400px] w-[400px] rounded-full bg-[#4400ff]/5 blur-[100px]" />
        <div className="absolute top-40 right-1/4 h-[300px] w-[300px] rounded-full bg-[#0066ff]/5 blur-[80px]" />

        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-16">
          {/* Logo/Brand */}
          <div className="mb-12 flex items-center justify-center gap-3">
            <div className="glow-blue rounded-xl border border-[#0000EE]/20 bg-[#0000EE]/10 p-2.5">
              <Shield className="h-7 w-7 text-[#4d7fff]" />
            </div>
            <span
              className="font-bold text-2xl text-white tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              CYMATE
            </span>
          </div>

          {/* Headline */}
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="label-text mb-4 text-[#4d7fff]">For B2B Businesses</p>
            <h1
              className="mb-6 font-extrabold text-5xl text-white leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Lead List <span className="gradient-text">MX Validator</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400 leading-relaxed md:text-xl">
              Upload your lead list and instantly verify which email domains
              have valid MX records. Stop wasting time on undeliverable emails.
            </p>
          </div>

          {/* Feature badges */}
          <div className="mb-14 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2.5 rounded-full border border-[#222] bg-[#111] px-5 py-2.5 transition-colors hover:border-[#0000EE]/30">
              <Zap className="h-4 w-4 text-[#ffd700]" />
              <span className="font-medium text-sm text-zinc-300">
                50x Concurrent Scans
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-full border border-[#222] bg-[#111] px-5 py-2.5 transition-colors hover:border-[#0000EE]/30">
              <Mail className="h-4 w-4 text-[#4d7fff]" />
              <span className="font-medium text-sm text-zinc-300">
                MX Record Verification
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-full border border-[#222] bg-[#111] px-5 py-2.5 transition-colors hover:border-[#0000EE]/30">
              <Shield className="h-4 w-4 text-[#00cc88]" />
              <span className="font-medium text-sm text-zinc-300">
                Protect Your Sender Rep
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        {stage === "idle" && (
          <UploadDropzone isUploading={false} onUpload={handleUpload} />
        )}

        {(stage === "uploading" || stage === "parsing") && (
          <ProgressIndicator progress={progress} stage={stage} />
        )}

        {stage === "scanning" && (
          <ProgressIndicator
            currentDomain={scanStats.currentDomain}
            domainsWithMx={scanStats.domainsWithMx}
            domainsWithoutMx={scanStats.domainsWithoutMx}
            progress={progress}
            recentResults={scanStats.recentResults}
            scannedDomains={scanStats.scannedDomains}
            stage={stage}
            totalDomains={scanStats.totalDomains}
          />
        )}

        {stage === "complete" && results.length > 0 && (
          <div className="space-y-6">
            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex items-center gap-1 rounded-full border border-[#222] bg-[#111] p-1">
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-all",
                      resultsView === "analytics"
                        ? "bg-[#0000EE] text-white shadow-lg"
                        : "text-zinc-400 hover:text-white"
                    )}
                    onClick={() => setResultsView("analytics")}
                    type="button"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </button>
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-all",
                      resultsView === "table"
                        ? "bg-[#0000EE] text-white shadow-lg"
                        : "text-zinc-400 hover:text-white"
                    )}
                    onClick={() => setResultsView("table")}
                    type="button"
                  >
                    <Table2 className="h-4 w-4" />
                    Data Table
                  </button>
                </div>
                <div className="text-sm text-zinc-500">
                  {uploadStats !== null && (
                    <span>
                      Processed {uploadStats.processedRows.toLocaleString()}{" "}
                      emails from {uploadStats.totalRows.toLocaleString()} rows
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="rounded-full border-[#222] px-5 text-zinc-300 hover:border-[#0000EE]/30 hover:bg-[#111]"
                  onClick={handleExport}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  className="rounded-full border-[#222] px-5 text-zinc-300 hover:border-[#0000EE]/30 hover:bg-[#111]"
                  onClick={handleReset}
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Scan Another File
                </Button>
              </div>
            </div>

            {/* Analytics View */}
            {resultsView === "analytics" && (
              <div data-testid="analytics-view">
                <EmailAnalytics
                  domainLeadCounts={domainLeadCounts}
                  leads={leads}
                  results={results}
                />
              </div>
            )}

            {/* Table View */}
            {resultsView === "table" && (
              <div data-testid="results-table">
                <ResultsTable
                  domainLeadCounts={domainLeadCounts}
                  leads={leads}
                  results={results}
                />
              </div>
            )}
          </div>
        )}

        {/* CTA Section */}
        {stage === "complete" && (
          <div className="relative mt-16 overflow-hidden rounded-2xl border border-[#1a1a1a] bg-linear-to-b from-[#111] to-[#0a0a0a] p-10 text-center">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 h-[200px] w-[600px] -translate-x-1/2 rounded-full bg-[#0000EE]/10 blur-[100px]" />

            <div className="relative">
              <h2
                className="mb-4 font-bold text-3xl text-white tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Ready to supercharge your cold email?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-zinc-400">
                Cymate helps agencies build high-quality lead lists and run cold
                email campaigns that actually convert.
              </p>
              <Button className="rounded-full bg-[#0000EE] px-10 py-6 font-semibold text-base text-white transition-all hover:-translate-y-0.5 hover:bg-[#0000cc] hover:shadow-[0_0_30px_rgba(0,0,238,0.3)]">
                Get Started with Cymate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-[#1a1a1a] border-t py-10">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-[#4d7fff]" />
            <span
              className="font-semibold text-sm text-zinc-300"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              CYMATE
            </span>
          </div>
          <p className="mb-2 text-sm text-zinc-500">
            Built for the IGNITE Cymate GTM Engineering Competition
          </p>
          <p className="text-xs text-zinc-600">
            Made with 🔥 by{" "}
            <a
              className="text-[#4d7fff] hover:underline"
              href="https://leadmagic.io"
              rel="noopener noreferrer"
              target="_blank"
            >
              Jesse Ouellette
            </a>{" "}
            of LeadMagic
          </p>
        </div>
      </footer>
    </div>
  );
}
