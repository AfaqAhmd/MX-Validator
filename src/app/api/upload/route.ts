import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { db, leads, type NewLead, uploads } from "@/lib/db";
import { extractDomain, isValidEmail, sanitizeString } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 100_000;

// Top-level regex patterns for performance
const EMAIL_EXTRACT_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const BOM_REGEX = /^\uFEFF/;
const CRLF_REGEX = /\r\n/g;
const CR_REGEX = /\r/g;

const ALLOWED_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
];

interface CSVRow {
  email?: string;
  Email?: string;
  EMAIL?: string;
  e_mail?: string;
  "E-mail"?: string;
  "E-Mail"?: string;
  "email address"?: string;
  "Email Address"?: string;
  first_name?: string;
  firstName?: string;
  FirstName?: string;
  "First Name"?: string;
  "first name"?: string;
  last_name?: string;
  lastName?: string;
  LastName?: string;
  "Last Name"?: string;
  "last name"?: string;
  company?: string;
  Company?: string;
  COMPANY?: string;
  organization?: string;
  Organization?: string;
  title?: string;
  Title?: string;
  TITLE?: string;
  "Job Title"?: string;
  "job title"?: string;
  position?: string;
  Position?: string;
  [key: string]: string | undefined;
}

function findEmail(row: CSVRow): string | null {
  // First try known email columns
  const knownEmailFields = [
    row.email,
    row.Email,
    row.EMAIL,
    row.e_mail,
    row["E-mail"],
    row["E-Mail"],
    row["email address"],
    row["Email Address"],
  ];

  for (const field of knownEmailFields) {
    if (field && isValidEmail(field)) {
      return sanitizeString(field);
    }
  }

  // Greedy: search ALL columns for anything that looks like an email
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (value && typeof value === "string" && value.includes("@")) {
      const emailMatch = value.match(EMAIL_EXTRACT_REGEX);
      if (emailMatch && isValidEmail(emailMatch[0])) {
        return sanitizeString(emailMatch[0]);
      }
    }
  }

  return null;
}

function normalizeRow(row: CSVRow): {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
} {
  const email = findEmail(row);
  const firstName = sanitizeString(
    row.first_name ||
      row.firstName ||
      row.FirstName ||
      row["First Name"] ||
      row["first name"] ||
      null
  );
  const lastName = sanitizeString(
    row.last_name ||
      row.lastName ||
      row.LastName ||
      row["Last Name"] ||
      row["last name"] ||
      null
  );
  const company = sanitizeString(
    row.company ||
      row.Company ||
      row.COMPANY ||
      row.organization ||
      row.Organization ||
      null
  );
  const title = sanitizeString(
    row.title ||
      row.Title ||
      row.TITLE ||
      row["Job Title"] ||
      row["job title"] ||
      row.position ||
      row.Position ||
      null
  );

  return { email, firstName, lastName, company, title };
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 255);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    // Validate file exists
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = file.type || "text/csv";
    if (
      !(ALLOWED_MIME_TYPES.includes(fileType) || file.name.endsWith(".csv"))
    ) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a CSV file." },
        { status: 400 }
      );
    }

    // Read and clean file content
    let text = await file.text();
    text = text.replace(BOM_REGEX, ""); // Remove BOM
    text = text.replace(CRLF_REGEX, "\n").replace(CR_REGEX, "\n"); // Normalize line endings

    // Parse CSV with flexible settings
    const parseResult = Papa.parse<CSVRow>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) =>
        header.trim().toLowerCase() === "email" ? "email" : header.trim(),
      delimitersToGuess: [",", "\t", "|", ";"],
      dynamicTyping: false,
      comments: "#",
    });

    // Check for critical parsing errors
    const criticalErrors = parseResult.errors.filter(
      (e) => e.type === "FieldMismatch" && e.code !== "TooFewFields"
    );

    if (criticalErrors.length > 0 && parseResult.data.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse CSV file. Please check the file format." },
        { status: 400 }
      );
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    // Enforce row limit
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `Too many rows. Maximum is ${MAX_ROWS.toLocaleString()} rows.`,
        },
        { status: 400 }
      );
    }

    // Create upload record with sanitized filename
    const [upload] = await db
      .insert(uploads)
      .values({
        filename: sanitizeFilename(file.name),
        totalRows: rows.length,
        processedRows: 0,
        status: "processing",
      })
      .returning();

    // Process rows and extract domains
    const leadsToInsert: NewLead[] = [];
    const uniqueDomains = new Set<string>();
    let skippedRows = 0;

    for (const row of rows) {
      const normalized = normalizeRow(row);

      if (!normalized.email) {
        skippedRows++;
        continue;
      }

      const domain = extractDomain(normalized.email);
      if (!domain) {
        skippedRows++;
        continue;
      }

      uniqueDomains.add(domain);

      leadsToInsert.push({
        uploadId: upload.id,
        email: normalized.email,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        company: normalized.company,
        title: normalized.title,
        domain,
      });
    }

    // Batch insert leads (100 at a time to avoid query size limits)
    if (leadsToInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        await db.insert(leads).values(batch);
      }
    }

    // Update upload status
    await db
      .update(uploads)
      .set({
        processedRows: leadsToInsert.length,
        status: "completed",
      })
      .where(eq(uploads.id, upload.id));

    console.log(
      `Processed ${leadsToInsert.length} leads, skipped ${skippedRows} rows, found ${uniqueDomains.size} unique domains`
    );

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      totalRows: rows.length,
      processedRows: leadsToInsert.length,
      skippedRows,
      uniqueDomains: Array.from(uniqueDomains),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload. Please try again." },
      { status: 500 }
    );
  }
}
