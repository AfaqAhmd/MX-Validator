import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Top-level regex patterns for performance
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const DOMAIN_REGEX =
  /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;

const MX_DATA_REGEX = /^(\d+)\s+(.+)$/;

const TRAILING_DOT_REGEX = /\.$/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeString(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== "string") return null;

  const cleaned = value
    .trim()
    .substring(0, 500)
    .replace(/[<>]/g, "")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

  return cleaned || null;
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length < 5 || trimmed.length > 254) return false;

  return EMAIL_REGEX.test(trimmed);
}

export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== "string") return false;

  const trimmed = domain.trim().toLowerCase();

  if (trimmed.length < 3 || trimmed.length > 253) return false;

  return DOMAIN_REGEX.test(trimmed);
}

export function extractDomain(email: string): string | null {
  if (!email || typeof email !== "string") return null;

  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split("@");

  if (parts.length !== 2) return null;

  const domain = parts[1];

  if (!domain?.includes(".")) return null;
  if (!isValidDomain(domain)) return null;

  return domain;
}

export function getFaviconUrl(domain: string): string {
  const sanitizedDomain = encodeURIComponent(domain);
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${sanitizedDomain}&size=32`;
}

export interface GoogleDNSResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: Array<{
    name: string;
    type: number;
  }>;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
  Comment?: string;
}

export function parseMXData(
  data: string
): { priority: number; exchange: string } | null {
  if (!data || typeof data !== "string") return null;

  const match = data.match(MX_DATA_REGEX);
  if (!match) return null;

  const priority = Number.parseInt(match[1], 10);
  if (Number.isNaN(priority) || priority < 0 || priority > 65_535) return null;

  const exchange = match[2].replace(TRAILING_DOT_REGEX, "").toLowerCase();
  if (!exchange || exchange.length > 253) return null;

  return { priority, exchange };
}

export const SECURITY_GATEWAY_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
  color: string;
}> = [
  { pattern: /proofpoint/i, name: "Proofpoint", color: "#f26522" },
  { pattern: /mimecast/i, name: "Mimecast", color: "#00b3f0" },
  { pattern: /barracuda/i, name: "Barracuda", color: "#009cda" },
  { pattern: /messagelabs|symantec/i, name: "Symantec", color: "#ffc000" },
  { pattern: /sophos/i, name: "Sophos", color: "#003366" },
  { pattern: /fortinet|fortimail/i, name: "Fortinet", color: "#ee3124" },
  { pattern: /trendmicro/i, name: "Trend Micro", color: "#d71920" },
  { pattern: /cisco|ironport/i, name: "Cisco", color: "#049fd9" },
  { pattern: /spamhero/i, name: "SpamHero", color: "#ff6b35" },
  { pattern: /mailroute/i, name: "MailRoute", color: "#2d89ef" },
];

export function detectSecurityGateway(
  mxHostname: string
): { name: string; color: string } | null {
  if (!mxHostname) return null;

  for (const gateway of SECURITY_GATEWAY_PATTERNS) {
    if (gateway.pattern.test(mxHostname)) {
      return { name: gateway.name, color: gateway.color };
    }
  }

  return null;
}
