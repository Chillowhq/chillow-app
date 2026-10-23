import { Loader2 } from "lucide-react"

export function PreparingMenuScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Preparing your menu...
          </h1>
          <p className="text-muted-foreground font-medium">
            We&apos;re securely connecting your digital menu.
          </p>
        </div>
      </div>
    </div>
  )
}
