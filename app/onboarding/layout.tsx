import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Get Started",
  description: "Set up your Chillow hospitality account in minutes. Create your account, verify your email, configure your business, and go live.",
}

export default function OnboardingRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Intentionally minimal — no sidebar, no navbar. The OnboardingLayout component
  // inside the page provides its own chrome.
  return <>{children}</>
}
