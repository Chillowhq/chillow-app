"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/axios-config"
import { PASSWORD_POLICY_MESSAGE, validateNewPassword } from "@/lib/password-policy"

function SetupAccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{
    valid: boolean;
    ownerName?: string;
    restaurantName?: string;
    message?: string;
  } | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenInfo({ valid: false, message: "No invitation token provided." })
      setIsValidating(false)
      return
    }

    const validateToken = async () => {
      try {
        const res = await apiClient.get(`/auth/invite/validate?token=${token}`)
        setTokenInfo(res.data)
      } catch (err) {
        console.error("Token validation error:", err)
        setTokenInfo({ valid: false, message: "Failed to validate invitation token." })
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (!validateNewPassword(password).valid) {
      toast.error(PASSWORD_POLICY_MESSAGE)
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      await apiClient.post("/auth/invite/setup-password", { token, password })

      setIsSuccess(true)
      toast.success("Password set successfully!")
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err: any) {
      console.error("Password setup error:", err)
      const message = err.response?.data?.message || "Failed to set password"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transform transition-all duration-500 animate-pulse overflow-hidden">
                <img src="/icon.png" alt="QuickServe" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-black text-3xl tracking-tight">
                <span className="text-[#EA601A]">Quick</span><span className="text-[#2B304C]">Serve</span>
            </h1>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!tokenInfo?.valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img src="/icon.png" alt="QuickServe" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-black text-3xl tracking-tight">
                <span className="text-[#EA601A]">Quick</span><span className="text-[#2B304C]">Serve</span>
            </h1>
        </div>
        <Card className="w-full max-w-md border-destructive/20 shadow-xl overflow-hidden">
          <div className="h-2 bg-destructive" />
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-destructive">Invalid Invitation</CardTitle>
            <CardDescription className="mt-2 text-base">
              {tokenInfo?.message || "This invitation link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pb-8">
            <Button variant="outline" className="w-full max-w-[200px]" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img src="/icon.png" alt="QuickServe" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-black text-3xl tracking-tight">
                <span className="text-[#EA601A]">Quick</span><span className="text-[#2B304C]">Serve</span>
            </h1>
        </div>
        <Card className="w-full max-w-md border-primary/20 shadow-xl overflow-hidden">
          <div className="h-2 bg-primary" />
          <CardHeader className="text-center pt-8">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-primary animate-in zoom-in duration-500" />
              </div>
            </div>
            <CardTitle className="text-3xl font-black text-[#2B304C]">Success!</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground leading-relaxed">
              Your password has been set. Redirecting you to the login page...
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-primary animate-progress origin-left" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-4">
      <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
              <img src="/icon.png" alt="QuickServe" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-black text-3xl tracking-tight">
              <span className="text-[#EA601A]">Quick</span><span className="text-[#2B304C]">Serve</span>
          </h1>
      </div>
      
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden rounded-[24px]">
        <div className="h-2 bg-gradient-to-r from-[#EA601A] to-[#FF8C00]" />
        <CardHeader className="text-center space-y-4 pt-10 px-8">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 bg-[#FDF2EC] rounded-2xl flex items-center justify-center shadow-sm border border-[#FBE3D5]">
              <Lock className="h-8 w-8 text-[#EA601A]" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black text-[#2B304C]">Welcome Aboard!</CardTitle>
          <CardDescription className="text-[16px] text-[#64748b] px-2">
            Hi <strong>{tokenInfo.ownerName}</strong>! Please set a secure password for <strong>{tokenInfo.restaurantName}</strong>.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6 px-10">
            <div className="space-y-3">
              <Label htmlFor="password" title="New Password" />
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 12 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  className="h-14 px-5 pr-12 rounded-xl border-[#E2E8F0] focus:ring-[#EA601A] focus:border-[#EA601A] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_MESSAGE}</p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="confirm-password" title="Confirm Password" />
              <div className="relative">
               <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  className="h-14 px-5 pr-12 rounded-xl border-[#E2E8F0] focus:ring-[#EA601A] focus:border-[#EA601A] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-8 pb-12 px-10">
            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold rounded-xl bg-[#EA601A] hover:bg-[#D45618] shadow-lg shadow-[#EA601A]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Finalizing...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <p className="mt-8 text-[#94A3B8] text-sm font-medium">
        &copy; 2026 QuickServe Platform &bull; Secure Account Activation
      </p>
    </div>
  )
}

export default function SetupAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SetupAccountContent />
    </Suspense>
  )
}
