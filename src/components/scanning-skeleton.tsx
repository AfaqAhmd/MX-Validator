"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ScanningSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary stats skeleton */}
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="mb-1 h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="h-10 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="mb-1 h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="h-10 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="mb-1 h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="border-zinc-800 border-b bg-zinc-900/70 p-4">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="flex items-center gap-4 p-4" key={i}>
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
