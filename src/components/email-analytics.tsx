"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Server,
  Shield,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DomainResult, Lead } from "./results-table";

interface EmailAnalyticsProps {
  results: DomainResult[];
  leads: Lead[];
  domainLeadCounts: Record<string, number>;
}

// Custom tooltip styles
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#333] bg-[#1a1a1a] px-4 py-3 shadow-xl">
        {label ? <p className="mb-1 text-xs text-zinc-400">{label}</p> : null}
        {payload.map((item) => (
          <p
            className="font-semibold text-white"
            key={`${item.name}-${item.value}`}
            style={{ color: item.color }}
          >
            {item.name}: {item.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom pie label
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) => {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      className="font-bold text-sm"
      dominantBaseline="central"
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      x={x}
      y={y}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function EmailAnalytics({
  results,
  leads,
  domainLeadCounts,
}: EmailAnalyticsProps) {
  // Build domain lookup map
  const domainMap = useMemo(
    () => new Map(results.map((r) => [r.domain, r])),
    [results]
  );

  // Calculate email deliverability stats
  const emailStats = useMemo(() => {
    const deliverable = leads.filter(
      (l) => domainMap.get(l.domain)?.hasMx
    ).length;
    const undeliverable = leads.length - deliverable;
    const deliverabilityRate =
      leads.length > 0 ? (deliverable / leads.length) * 100 : 0;

    return {
      total: leads.length,
      deliverable,
      undeliverable,
      deliverabilityRate,
    };
  }, [leads, domainMap]);

  // Email deliverability pie chart data
  const deliverabilityData = useMemo(
    () => [
      { name: "Deliverable", value: emailStats.deliverable, color: "#00cc88" },
      {
        name: "Undeliverable",
        value: emailStats.undeliverable,
        color: "#ff4444",
      },
    ],
    [emailStats]
  );

  // Domain stats
  const domainStats = useMemo(() => {
    const withMx = results.filter((r) => r.hasMx).length;
    const withoutMx = results.filter((r) => !r.hasMx).length;
    const withGateway = results.filter((r) => r.securityGatewayName).length;

    return {
      total: results.length,
      withMx,
      withoutMx,
      withGateway,
    };
  }, [results]);

  // Domain MX status pie chart
  const _domainMxData = useMemo(
    () => [
      { name: "Valid MX", value: domainStats.withMx, color: "#4d7fff" },
      { name: "No MX", value: domainStats.withoutMx, color: "#ff4444" },
    ],
    [domainStats]
  );

  // Top domains by lead count
  const topDomainsData = useMemo(() => {
    const sorted = Object.entries(domainLeadCounts)
      .map(([domain, count]) => ({
        domain: domain.length > 15 ? `${domain.substring(0, 15)}...` : domain,
        fullDomain: domain,
        leads: count,
        hasMx: domainMap.get(domain)?.hasMx ?? false,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);

    return sorted;
  }, [domainLeadCounts, domainMap]);

  // Security gateway distribution
  const gatewayData = useMemo(() => {
    const gatewayCounts: Record<string, { count: number; color: string }> = {};
    let noGatewayCount = 0;

    for (const result of results) {
      if (result.securityGatewayName) {
        if (!gatewayCounts[result.securityGatewayName]) {
          gatewayCounts[result.securityGatewayName] = {
            count: 0,
            color: result.securityGatewayColor || "#8b5cf6",
          };
        }
        gatewayCounts[result.securityGatewayName].count++;
      } else if (result.hasMx) {
        noGatewayCount++;
      }
    }

    const data = Object.entries(gatewayCounts)
      .map(([name, { count, color }]) => ({
        name,
        value: count,
        color,
      }))
      .sort((a, b) => b.value - a.value);

    if (noGatewayCount > 0) {
      data.push({ name: "No Gateway", value: noGatewayCount, color: "#555" });
    }

    return data;
  }, [results]);

  // MX Provider distribution (from MX records)
  const mxProviderData = useMemo(() => {
    const providers: Record<string, number> = {};

    for (const result of results) {
      if (result.mxRecords.length > 0) {
        // Get primary MX (lowest priority)
        const primaryMx = result.mxRecords.sort(
          (a, b) => a.priority - b.priority
        )[0];
        const exchange = primaryMx.exchange.toLowerCase();

        // Categorize by provider
        let provider = "Other";
        if (exchange.includes("google") || exchange.includes("gmail")) {
          provider = "Google Workspace";
        } else if (
          exchange.includes("outlook") ||
          exchange.includes("microsoft")
        ) {
          provider = "Microsoft 365";
        } else if (exchange.includes("zoho")) {
          provider = "Zoho";
        } else if (
          exchange.includes("protonmail") ||
          exchange.includes("proton")
        ) {
          provider = "Proton";
        } else if (exchange.includes("mimecast")) {
          provider = "Mimecast";
        } else if (exchange.includes("barracuda")) {
          provider = "Barracuda";
        } else if (
          exchange.includes("pphosted") ||
          exchange.includes("proofpoint")
        ) {
          provider = "Proofpoint";
        } else if (
          exchange.includes("messagelabs") ||
          exchange.includes("symantec")
        ) {
          provider = "Symantec";
        } else if (
          exchange.includes("amazonses") ||
          exchange.includes("amazonaws")
        ) {
          provider = "Amazon SES";
        } else if (exchange.includes("sendgrid")) {
          provider = "SendGrid";
        } else if (exchange.includes("mailgun")) {
          provider = "Mailgun";
        }

        providers[provider] = (providers[provider] || 0) + 1;
      }
    }

    const colors: Record<string, string> = {
      "Google Workspace": "#4285f4",
      "Microsoft 365": "#00a4ef",
      Zoho: "#c8202b",
      Proton: "#6d4aff",
      Mimecast: "#00b3f0",
      Barracuda: "#009cda",
      Proofpoint: "#f26522",
      Symantec: "#ffc000",
      "Amazon SES": "#ff9900",
      SendGrid: "#1a82e2",
      Mailgun: "#e34c26",
      Other: "#666",
    };

    return Object.entries(providers)
      .map(([name, count]) => ({
        name,
        value: count,
        color: colors[name] || "#666",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [results]);

  // Email quality score (radial gauge)
  const qualityScore = useMemo(() => {
    let score = emailStats.deliverabilityRate;

    // Penalize for high security gateway presence (harder to reach)
    const gatewayPenalty =
      (domainStats.withGateway / Math.max(domainStats.total, 1)) * 10;
    score = Math.max(0, score - gatewayPenalty);

    return Math.round(score);
  }, [emailStats.deliverabilityRate, domainStats]);

  const qualityGaugeData = [
    {
      name: "Score",
      value: qualityScore,
      fill:
        qualityScore >= 70
          ? "#00cc88"
          : qualityScore >= 40
            ? "#ffd700"
            : "#ff4444",
    },
  ];

  if (leads.length === 0 && results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          iconBg="bg-[#4d7fff]/10"
          iconColor="text-[#4d7fff]"
          label="Total Emails"
          value={emailStats.total.toLocaleString()}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="bg-[#00cc88]/10"
          iconColor="text-[#00cc88]"
          label="Deliverable"
          subValue={`${emailStats.deliverabilityRate.toFixed(1)}%`}
          value={emailStats.deliverable.toLocaleString()}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          iconBg="bg-[#ff4444]/10"
          iconColor="text-[#ff4444]"
          label="Undeliverable"
          value={emailStats.undeliverable.toLocaleString()}
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          iconBg="bg-[#8b5cf6]/10"
          iconColor="text-[#8b5cf6]"
          label="With Security Gateway"
          value={domainStats.withGateway.toLocaleString()}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Email Deliverability Donut */}
        <ChartCard
          icon={<TrendingUp className="h-4 w-4" />}
          subtitle="Breakdown of your lead list quality"
          title="Email Deliverability"
        >
          <div className="flex items-center justify-center">
            <ResponsiveContainer height={280} width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={deliverabilityData}
                  dataKey="value"
                  innerRadius={70}
                  label={renderCustomizedLabel}
                  labelLine={false}
                  outerRadius={110}
                  paddingAngle={3}
                >
                  {deliverabilityData.map((entry) => (
                    <Cell
                      fill={entry.color}
                      key={`cell-${entry.name}`}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-sm text-zinc-300">{value}</span>
                  )}
                  height={36}
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-4 text-center">
            <p className="font-bold text-3xl text-white">
              {emailStats.deliverabilityRate.toFixed(1)}%
            </p>
            <p className="text-sm text-zinc-500">Deliverability Rate</p>
          </div>
        </ChartCard>

        {/* Quality Score Gauge */}
        <ChartCard
          icon={<AlertTriangle className="h-4 w-4" />}
          subtitle="Overall health of your email list"
          title="List Quality Score"
        >
          <div className="flex items-center justify-center">
            <ResponsiveContainer height={280} width="100%">
              <RadialBarChart
                barSize={20}
                cx="50%"
                cy="50%"
                data={qualityGaugeData}
                endAngle={0}
                innerRadius="60%"
                outerRadius="90%"
                startAngle={180}
              >
                <RadialBar
                  background={{ fill: "#222" }}
                  cornerRadius={10}
                  dataKey="value"
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="relative z-10 -mt-20 text-center">
            <p
              className="font-bold text-5xl"
              style={{
                color:
                  qualityScore >= 70
                    ? "#00cc88"
                    : qualityScore >= 40
                      ? "#ffd700"
                      : "#ff4444",
              }}
            >
              {qualityScore}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {qualityScore >= 70
                ? "Excellent"
                : qualityScore >= 40
                  ? "Needs Attention"
                  : "Poor Quality"}
            </p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[#ff4444]/10 p-2">
              <p className="font-semibold text-[#ff4444]">0-40</p>
              <p className="text-zinc-500">Poor</p>
            </div>
            <div className="rounded-lg bg-[#ffd700]/10 p-2">
              <p className="font-semibold text-[#ffd700]">41-70</p>
              <p className="text-zinc-500">Fair</p>
            </div>
            <div className="rounded-lg bg-[#00cc88]/10 p-2">
              <p className="font-semibold text-[#00cc88]">71-100</p>
              <p className="text-zinc-500">Excellent</p>
            </div>
          </div>
        </ChartCard>

        {/* Top Domains Bar Chart */}
        <ChartCard
          className="lg:col-span-2"
          icon={<Server className="h-4 w-4" />}
          subtitle="Domains with the most contacts"
          title="Top Domains by Lead Count"
        >
          <ResponsiveContainer height={300} width="100%">
            <BarChart
              data={topDomainsData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="#222"
                strokeDasharray="3 3"
              />
              <XAxis fontSize={12} stroke="#666" type="number" />
              <YAxis
                dataKey="domain"
                fontSize={11}
                stroke="#666"
                tick={{ fill: "#888" }}
                type="category"
                width={120}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-[#333] bg-[#1a1a1a] px-4 py-3 shadow-xl">
                        <p className="font-semibold text-white">
                          {data.fullDomain}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {data.leads.toLocaleString()} leads
                        </p>
                        <p
                          className={`text-sm ${data.hasMx ? "text-[#00cc88]" : "text-[#ff4444]"}`}
                        >
                          {data.hasMx ? "✓ Valid MX" : "✗ No MX"}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                {topDomainsData.map((entry) => (
                  <Cell
                    fill={entry.hasMx ? "#4d7fff" : "#ff4444"}
                    key={`cell-${entry.fullDomain}`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Security Gateway Distribution */}
        {gatewayData.length > 0 && (
          <ChartCard
            icon={<Shield className="h-4 w-4" />}
            subtitle="Email security providers detected"
            title="Security Gateway Distribution"
          >
            <ResponsiveContainer height={280} width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={gatewayData}
                  dataKey="value"
                  labelLine={false}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {gatewayData.map((entry) => (
                    <Cell
                      fill={entry.color}
                      key={`cell-${entry.name}`}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-zinc-400">{value}</span>
                  )}
                  height={36}
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* MX Provider Distribution */}
        {mxProviderData.length > 0 && (
          <ChartCard
            icon={<Mail className="h-4 w-4" />}
            subtitle="Primary MX record providers"
            title="Email Provider Distribution"
          >
            <ResponsiveContainer height={280} width="100%">
              <BarChart
                data={mxProviderData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="#222"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  angle={-45}
                  dataKey="name"
                  fontSize={10}
                  height={70}
                  stroke="#666"
                  textAnchor="end"
                  tick={{ fill: "#888" }}
                />
                <YAxis fontSize={12} stroke="#666" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Domains" radius={[4, 4, 0, 0]}>
                  {mxProviderData.map((entry) => (
                    <Cell fill={entry.color} key={`cell-${entry.name}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Insights Section */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#111] p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg text-white">
          <TrendingUp className="h-5 w-5 text-[#4d7fff]" />
          Key Insights
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <InsightCard
            description={
              emailStats.deliverabilityRate >= 70
                ? `${emailStats.deliverabilityRate.toFixed(0)}% of your emails can be delivered. Your list is healthy!`
                : `Only ${emailStats.deliverabilityRate.toFixed(0)}% of your emails can be delivered. Consider cleaning your list.`
            }
            title={
              emailStats.deliverabilityRate >= 70
                ? "High Deliverability"
                : "Deliverability Concerns"
            }
            type={
              emailStats.deliverabilityRate >= 70
                ? "success"
                : emailStats.deliverabilityRate >= 40
                  ? "warning"
                  : "error"
            }
          />
          {domainStats.withGateway > 0 && (
            <InsightCard
              description={`${domainStats.withGateway} domains (${((domainStats.withGateway / domainStats.withMx) * 100).toFixed(0)}%) have security gateways. Expect higher bounce rates from these.`}
              title="Security Gateways Detected"
              type="info"
            />
          )}
          {emailStats.undeliverable > 0 && (
            <InsightCard
              description={`${emailStats.undeliverable.toLocaleString()} emails are going to domains without valid MX records. These will bounce.`}
              title="Invalid Domains Found"
              type="error"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  subValue,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#111] p-4 transition-colors hover:border-[#333]">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <p className="font-bold text-2xl text-white">{value}</p>
            {subValue ? (
              <span className="text-[#00cc88] text-sm">{subValue}</span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#1a1a1a] bg-[#111] p-6 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-base text-white">
            <span className="text-[#4d7fff]">{icon}</span>
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function InsightCard({
  type,
  title,
  description,
}: {
  type: "success" | "warning" | "error" | "info";
  title: string;
  description: string;
}) {
  const styles = {
    success: {
      bg: "bg-[#00cc88]/10",
      border: "border-[#00cc88]/20",
      icon: <CheckCircle2 className="h-4 w-4 text-[#00cc88]" />,
    },
    warning: {
      bg: "bg-[#ffd700]/10",
      border: "border-[#ffd700]/20",
      icon: <AlertTriangle className="h-4 w-4 text-[#ffd700]" />,
    },
    error: {
      bg: "bg-[#ff4444]/10",
      border: "border-[#ff4444]/20",
      icon: <XCircle className="h-4 w-4 text-[#ff4444]" />,
    },
    info: {
      bg: "bg-[#4d7fff]/10",
      border: "border-[#4d7fff]/20",
      icon: <Shield className="h-4 w-4 text-[#4d7fff]" />,
    },
  };

  const style = styles[type];

  return (
    <div className={`rounded-lg p-4 ${style.bg} border ${style.border}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{style.icon}</div>
        <div>
          <p className="font-medium text-sm text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
