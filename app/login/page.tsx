"use client"

import { isAxiosError } from "axios"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/axios-config"
import { getFirstPermittedManagementPath } from "@/lib/manager-permissions"

type ViewState = "login" | "forgot-password"
type LoginFieldErrors = {
  email?: string
  password?: string
}

function getLoginErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: unknown }>(error)) {
    const message = error.response?.data?.message
    if (typeof message === "string" && message.trim()) return message
  }

  return "Unable to sign in right now. Please try again."
}

export default function LoginPage() {
  const router = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<ViewState>("login")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [resetEmail, setResetEmail] = useState("")
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const validateLogin = () => {
    const nextErrors: LoginFieldErrors = {}
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      nextErrors.email = "Enter your email address."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address."
    }

    if (!password) nextErrors.password = "Enter your password."

    setFieldErrors(nextErrors)

    if (nextErrors.email) {
      emailInputRef.current?.focus()
    } else if (nextErrors.password) {
      passwordInputRef.current?.focus()
    }

    return Object.keys(nextErrors).length === 0
  }

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)

    if (!validateLogin()) return

    setIsLoginLoading(true)

    try {
      await apiClient.post("/auth/login", { email, password })
      const meRes = await apiClient.get("/auth/me")
      const user = meRes.data

      if (user.role === "owner" || user.role === "admin") {
        router.push("/owner/dashboard")
      } else if (user.role === "co_owner" || user.role === "manager") {
        router.push(getFirstPermittedManagementPath(user))
      } else if (user.role === "kitchen") {
        router.push("/kitchen")
      } else if (user.role === "waiter" || user.role === "waitstaff") {
        router.push("/waitstaff")
      } else if (user.role === "bartender") {
        router.push("/bar")
      } else if (user.role === "housekeeping") {
        router.push("/housekeeping")
      } else {
        router.push("/owner/dashboard")
      }

      toast.success("Welcome back!")
    } catch (error: unknown) {
      console.error("Login error:", error)
      setServerError(getLoginErrorMessage(error))
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleForgotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsResetLoading(true)

    try {
      await apiClient.post("/auth/forgot-password", { email: resetEmail })
      setResetSuccess(true)
      toast.success("Reset link sent!", {
        description: "Please check your inbox for instructions.",
      })
    } catch (error: unknown) {
      console.error("Forgot password error:", error)
      toast.error("Failed to process request. Please try again.")
    } finally {
      setIsResetLoading(false)
    }
  }

  const showForgotPassword = () => {
    setServerError(null)
    setView("forgot-password")
  }

  const showLogin = () => {
    setView("login")
    setResetSuccess(false)
    setResetEmail("")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-12 sm:px-8">
      <section className="w-full max-w-md">
        {view === "login" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
              <span className="h-3 w-0.5 rounded-full bg-primary" aria-hidden="true" />
              Team sign in
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground sm:text-5xl">Sign in</h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Enter your credentials to access your business&apos;s workspace.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit} noValidate>
              {serverError && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
                  <p className="min-w-0 flex-1 leading-relaxed">{serverError}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setServerError(null)}
                    aria-label="Dismiss sign-in error"
                    className="-mr-1 -mt-1 text-foreground hover:bg-destructive/10 hover:text-foreground"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    ref={emailInputRef}
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@business.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }))
                    }}
                    disabled={isLoginLoading}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    className="h-12 rounded-lg bg-card pl-10 shadow-none"
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={showForgotPassword}
                    disabled={isLoginLoading}
                    className="h-auto p-0 text-sm font-semibold text-foreground"
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }))
                    }}
                    disabled={isLoginLoading}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    className="h-12 rounded-lg bg-card pl-10 pr-12 shadow-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={isLoginLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoginLoading}
                aria-busy={isLoginLoading}
                className="h-12 w-full rounded-lg bg-primary text-base font-bold text-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                {isLoginLoading ? (
                  <>
                    <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Access Portal
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
              Ask your manager to verify access, or{" "}
              <a
                className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/75 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href="mailto:support@chillow.io"
              >
                contact support
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            <Button type="button" variant="ghost" size="sm" onClick={showLogin} className="mb-8 -ml-3">
              <ArrowLeft aria-hidden="true" /> Back to sign in
            </Button>

            {!resetSuccess ? (
              <>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
                  <span className="h-3 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                  Account recovery
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">Reset password</h1>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  We&apos;ll send a secure recovery link to the email address connected to your account.
                </p>

                <form className="mt-8 space-y-5" onSubmit={handleForgotSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email address</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="reset-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="name@business.com"
                        value={resetEmail}
                        onChange={(event) => setResetEmail(event.target.value)}
                        disabled={isResetLoading}
                        required
                        className="h-12 rounded-lg bg-card pl-10 shadow-none"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isResetLoading}
                    aria-busy={isResetLoading}
                    className="h-12 w-full rounded-lg bg-foreground text-base font-bold text-background hover:bg-foreground/90"
                  >
                    {isResetLoading ? (
                      <>
                        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Sending…
                      </>
                    ) : (
                      "Send recovery link"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-6" aria-hidden="true" />
                </span>
                <h1 className="mt-5 text-2xl font-bold text-card-foreground">Check your inbox</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  We sent password reset instructions to <strong className="font-semibold text-card-foreground">{resetEmail}</strong>.
                </p>
                <Button type="button" variant="outline" size="lg" onClick={showLogin} className="mt-6 w-full">
                  Return to sign in
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
