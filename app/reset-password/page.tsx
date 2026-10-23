"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/axios-config"
import { PASSWORD_POLICY_MESSAGE, validateNewPassword } from "@/lib/password-policy"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
        toast.error("Invalid or missing reset token. Please request a new link.")
        return
    }

    if (!validateNewPassword(password).valid) {
        toast.error(PASSWORD_POLICY_MESSAGE)
        return
    }

    if (password !== confirmPassword) {
        toast.error("Passwords do not match.")
        return
    }

    if (isLoading) return
    setIsLoading(true)

    try {
      await apiClient.post("/auth/reset-password", { token, password })
      setIsSuccess(true)
      toast.success("Password successfully reset!")
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err: any) {
      console.error("Reset password error:", err)
      const errorMessage = err.response?.data?.message || "Failed to reset password. The link might be expired."
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#2B304C]/5 to-transparent -z-10" />
      <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-400/20 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/10 rounded-full blur-[120px] -z-10" />

      {/* Brand Logo */}
      <div className="flex items-center gap-4 mb-10 transition-all">
          <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-black/20 overflow-hidden bg-white">
              <img src="/icon.png" alt="Chillow logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-black text-4xl tracking-tight leading-none text-[#0f172a]">
                Account Security
            </h1>
            <p className="text-[13px] text-gray-500 font-bold tracking-[0.2em] uppercase mt-1">Chillow Partner Portal</p>
          </div>
      </div>
      
      <div className="relative w-full max-w-[440px]">
        {/* Form View */}
        <Card className="w-full shadow-2xl border border-gray-100 overflow-hidden rounded-[2rem] bg-white/80 backdrop-blur-xl transition-all duration-500 relative">
          {!isSuccess ? (
             <>
             <CardHeader className="text-center pt-10 pb-4 px-10">
               <CardTitle className="text-3xl font-black text-[#2B304C]">New Password</CardTitle>
               <CardDescription className="text-base text-gray-500 mt-2">
                 Enter your new password below for your Chillow account.
               </CardDescription>
             </CardHeader>
             
             <form onSubmit={handleSubmit}>
               <CardContent className="space-y-6 pt-4 px-10">
                 {!token && (
                     <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 text-center mb-2">
                         Missing security token. Please click the link in your email again.
                     </div>
                 )}
                 
                 <div className="space-y-2.5">
                   <Label htmlFor="password" className="text-sm font-bold text-[#2B304C] ml-1">New Password</Label>
                   <div className="relative group">
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f172a] transition-colors">
                       <Lock className="h-5 w-5" />
                     </div>
                     <Input
                       id="password"
                       type={showPassword ? "text" : "password"}
                       placeholder="••••••••"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       required
                       minLength={12}
                       disabled={!token}
                       className="h-14 pl-12 pr-12 rounded-2xl border-gray-200 focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] bg-gray-50/50 hover:bg-gray-50 transition-all font-medium tracking-widest"
                     />
                     <button
                       type="button"
                       onClick={() => setShowPassword(!showPassword)}
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                       tabIndex={-1}
                       disabled={!token}
                     >
                       {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                     </button>
                   </div>
                   <p className="text-xs text-gray-500 ml-1">{PASSWORD_POLICY_MESSAGE}</p>
                 </div>
                 
                 <div className="space-y-2.5">
                   <Label htmlFor="confirmPassword" className="text-sm font-bold text-[#2B304C] ml-1">Confirm Password</Label>
                   <div className="relative group">
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f172a] transition-colors">
                       <Lock className="h-5 w-5" />
                     </div>
                     <Input
                       id="confirmPassword"
                       type={showConfirmPassword ? "text" : "password"}
                       placeholder="••••••••"
                       value={confirmPassword}
                       onChange={(e) => setConfirmPassword(e.target.value)}
                       required
                       minLength={12}
                       disabled={!token}
                       className="h-14 pl-12 pr-12 rounded-2xl border-gray-200 focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] bg-gray-50/50 hover:bg-gray-50 transition-all font-medium tracking-widest"
                     />
                     <button
                       type="button"
                       onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                       tabIndex={-1}
                       disabled={!token}
                     >
                       {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                     </button>
                   </div>
                 </div>
               </CardContent>
               
               <CardFooter className="pt-8 pb-10 px-10">
                 <Button
                   type="submit"
                   className="w-full h-14 text-[17px] font-bold rounded-2xl bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-xl shadow-[#0f172a]/25 transition-all hover:scale-[1.02] active:scale-[0.98] group"
                   disabled={isLoading || !token}
                 >
                   {isLoading ? (
                     <>
                       <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                       Updating...
                     </>
                   ) : (
                     <span className="flex items-center justify-center w-full relative">
                       Save Password 
                       <ArrowRight className="w-5 h-5 absolute right-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                     </span>
                   )}
                 </Button>
               </CardFooter>
             </form>
             </>
          ) : (
            <div className="pt-16 pb-12 px-10 text-center animate-in fade-in zoom-in duration-500 block h-[420px] flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-black text-[#2B304C] mb-2">Password Reset!</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
                Your password has been successfully updated. You will be redirected to the login page momentarily.
              </p>
              <Button 
                onClick={() => router.push("/login")}
                variant="outline"
                className="h-14 w-full rounded-2xl font-bold border-gray-200 hover:bg-gray-50"
              >
                Go to Sign In Now
              </Button>
            </div>
          )}
        </Card>
      </div>
      
      <div className="mt-12 text-center relative z-10 w-full max-w-[440px]">
        <div className="mt-8 flex items-center justify-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <span>&copy; {new Date().getFullYear()} Chillow</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <a href="#" className="hover:text-gray-600 transition-colors">Privacy</a>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <a href="#" className="hover:text-gray-600 transition-colors">Terms</a>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}
