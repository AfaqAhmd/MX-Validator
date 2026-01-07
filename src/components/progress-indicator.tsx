"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  stage: "uploading" | "parsing" | "scanning" | "complete";
  progress: number;
  currentDomain?: string;
  totalDomains?: number;
  scannedDomains?: number;
  domainsWithMx?: number;
  domainsWithoutMx?: number;
  recentResults?: Array<{ domain: string; hasMx: boolean }>;
}

const stageLabels = {
  uploading: "Uploading CSV...",
  parsing: "Parsing lead data...",
  scanning: "Scanning MX records...",
  complete: "Scan complete!",
};

export function ProgressIndicator({
  stage,
  progress,
  currentDomain,
  totalDomains,
  scannedDomains,
  domainsWithMx = 0,
  domainsWithoutMx = 0,
  recentResults = [],
}: ProgressIndicatorProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 50);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div
      className="relative space-y-4 overflow-hidden rounded-2xl border border-[#1a1a1a] bg-linear-to-b from-[#0f0f0f] to-[#0a0a0a] p-8"
      data-testid={`progress-${stage}`}
    >
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 h-[200px] w-[400px] -translate-x-1/2 rounded-full bg-[#0000EE]/5 blur-[80px]" />

      {/* Main progress section */}
      <div className="relative flex items-center gap-4">
        {stage !== "complete" ? (
          <div className="relative">
            <Loader2 className="h-7 w-7 animate-spin text-[#4d7fff]" />
            <div className="absolute inset-0 h-7 w-7 animate-ping rounded-full bg-[#0000EE]/30" />
          </div>
        ) : (
          <div className="rounded-full bg-[#00cc88]/20 p-1.5">
            <CheckCircle2 className="h-5 w-5 text-[#00cc88]" />
          </div>
        )}
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <p
              className="font-semibold text-base text-zinc-100"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {stageLabels[stage]}
            </p>
            <p className="font-mono font-semibold text-[#4d7fff] text-sm">
              {Math.round(displayProgress)}%
            </p>
          </div>
          <div className="relative">
            <Progress className="h-3 bg-[#1a1a1a]" value={displayProgress} />
            {/* Animated shine effect */}
            {stage === "scanning" && (
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-linear-to-r from-transparent via-[#0000EE]/20 to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats during scanning */}
      {stage === "scanning" && totalDomains && (
        <div className="relative space-y-4" data-testid="scan-stats">
          {/* Domain counter */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              Scanned{" "}
              <span className="font-mono font-semibold text-zinc-200">
                {scannedDomains || 0}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold text-zinc-200">
                {totalDomains}
              </span>{" "}
              domains
            </span>
            <span className="font-medium text-xs text-zinc-600">
              {totalDomains - (scannedDomains || 0)} remaining
            </span>
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-6 rounded-xl border border-[#1a1a1a] bg-[#111] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00cc88]/20 bg-[#00cc88]/10">
                <CheckCircle2 className="h-5 w-5 text-[#00cc88]" />
              </div>
              <div>
                <p className="font-bold font-mono text-[#00cc88] text-xl tabular-nums">
                  {domainsWithMx}
                </p>
                <p className="font-semibold text-[10px] text-zinc-500 uppercase tracking-widest">
                  Valid MX
                </p>
              </div>
            </div>
            <div className="h-12 w-px bg-[#222]" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold font-mono text-red-400 text-xl tabular-nums">
                  {domainsWithoutMx}
                </p>
                <p className="font-semibold text-[10px] text-zinc-500 uppercase tracking-widest">
                  No MX
                </p>
              </div>
            </div>
          </div>

          {/* Current domain being scanned */}
          {currentDomain ? (
            <div
              className="flex items-center gap-2 text-xs"
              data-testid="current-domain"
            >
              <span className="text-zinc-500">Currently scanning:</span>
              <span className="max-w-[300px] animate-pulse truncate font-mono text-[#4d7fff]">
                {currentDomain}
              </span>
            </div>
          ) : null}

          {/* Recent results feed */}
          {recentResults.length > 0 && (
            <div
              className="max-h-36 space-y-2 overflow-hidden"
              data-testid="recent-results"
            >
              <p className="font-semibold text-[10px] text-zinc-500 uppercase tracking-widest">
                Recent scans
              </p>
              <div className="space-y-1.5">
                {recentResults.slice(-5).map((result, idx) => (
                  <div
                    className="slide-in-from-top-2 flex animate-in items-center gap-2 text-xs duration-300"
                    key={`${result.domain}-${idx}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {result.hasMx ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00cc88]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <span className="truncate font-mono text-zinc-400">
                      {result.domain}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
