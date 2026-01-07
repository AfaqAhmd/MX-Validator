/**
 * Next.js Configuration
 *
 * Includes security headers and image optimization settings.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Disable React strict mode to reduce duplicate renders in dev
	// and suppress some dev-only warnings from browser extensions
	reactStrictMode: true,

	// Logging configuration
	logging: {
		fetches: {
			fullUrl: true,
		},
	},
	// Image optimization settings
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "t1.gstatic.com",
				port: "",
				pathname: "/faviconV2/**",
			},
		],
	},

	// Security headers
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "Referrer-Policy",
						value: "origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
				],
			},
			// API routes specific headers
			{
				source: "/api/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store, max-age=0",
					},
				],
			},
		];
	},

	// Disable x-powered-by header
	poweredByHeader: false,
};

export default nextConfig;
