import { withSentryConfig } from "@sentry/nextjs/config";
/** @type {import('next').NextConfig} */
function getCanonicalFrontendOrigin() {
  const configured = process.env.FRONTEND_BASE_URL?.trim()

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FRONTEND_BASE_URL is required for production builds")
    }

    return ""
  }

  try {
    const url = new URL(configured)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.origin === "null"
    ) {
      throw new Error("invalid origin")
    }

    return url.origin
  } catch {
    throw new Error(
      "FRONTEND_BASE_URL must be an exact HTTP(S) origin without a path, query, fragment, or credentials",
    )
  }
}

const canonicalFrontendOrigin = getCanonicalFrontendOrigin()

const nextConfig = {
  env: {
    NEXT_PUBLIC_FRONTEND_BASE_URL: canonicalFrontendOrigin,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "chillow-or",

  project: "quick-serve-qr-menu",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
