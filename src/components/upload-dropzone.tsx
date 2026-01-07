"use client";

import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function UploadDropzone({
  onUpload,
  isUploading,
  disabled,
}: UploadDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    disabled: isUploading || disabled,
    useFsAccessApi: false, // Disable File System Access API to avoid NotAllowedError
  });

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4" data-testid="upload-container">
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed p-12 transition-all duration-300",
          "bg-gradient-to-b from-zinc-900/50 to-zinc-950/50",
          isDragActive && "border-emerald-500 bg-emerald-500/5",
          !isDragActive && "border-zinc-700 hover:border-zinc-500",
          (isUploading || disabled) && "cursor-not-allowed opacity-50"
        )}
        data-testid="upload-dropzone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div
            className={cn(
              "rounded-full p-4 transition-colors",
              isDragActive ? "bg-emerald-500/20" : "bg-zinc-800"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragActive ? "text-emerald-400" : "text-zinc-400"
              )}
            />
          </div>
          <div>
            <p className="font-medium text-lg text-zinc-200">
              {isDragActive
                ? "Drop your CSV here"
                : "Drag & drop your CSV file"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">or click to browse</p>
          </div>
          <p className="text-xs text-zinc-600">
            CSV files only • Supports email, name, company, and title columns
          </p>
        </div>
      </div>

      {selectedFile !== null && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-zinc-200">
                {selectedFile.name}
              </p>
              <p className="text-xs text-zinc-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="text-zinc-400 hover:text-zinc-200"
              disabled={isUploading}
              onClick={clearFile}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isUploading}
              onClick={handleUpload}
            >
              {isUploading ? "Scanning..." : "Scan MX Records"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
