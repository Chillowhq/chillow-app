"use client"

import { useState, useEffect } from "react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import {
  Users,
  Shield,
  Loader2,
  Trash2,
  Plus,
  Mail,
  User,
  ArrowLeft,
  ExternalLink,
  Lock,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CO_OWNER_ACCESS_GROUPS, type ManagementAccessArea } from "@/lib/manager-permissions"

interface TeamMember {
  id?: string
  staffId?: string
  name: string
  email: string
  role: string
  accountStatus?: string
  createdAt?: string
  coOwnerRestrictions?: ManagementAccessArea[]
  managementAccessAreas?: ManagementAccessArea[]
}

export default function TeamAccessPage() {
  const { user, loading: authLoading } = useAuthGuard({ requiredRole: "primary_owner" })
  const businessId = user?.businessId

  const [isLoading, setIsLoading] = useState(true)
  const [primaryOwner, setPrimaryOwner] = useState<TeamMember | null>(null)
  const [coOwners, setCoOwners] = useState<TeamMember[]>([])
  
  // Invite form state
  const [isInviting, setIsInviting] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savingAccessKey, setSavingAccessKey] = useState<string | null>(null)
  const [collapsedCoOwners, setCollapsedCoOwners] = useState<Set<string>>(() => new Set())

  const toggleCoOwnerCollapsed = (staffId: string) => {
    setCollapsedCoOwners((current) => {
      const next = new Set(current)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }

  const fetchTeam = async () => {
    try {
      setIsLoading(true)
      const res = await apiClient.get("/owner/team")
      setPrimaryOwner(res.data.owner)
      setCoOwners(res.data.coOwners || [])
    } catch (err: any) {
      console.error("Failed to fetch team", err)
      toast.error(err.response?.data?.error || "Failed to load team access settings")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (businessId) {
      fetchTeam()
    }
  }, [businessId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) return

    try {
      setIsSubmitting(true)
      await apiClient.post("/owner/team/co-owner", {
        name: inviteName,
        email: inviteEmail
      })
      toast.success("Co-Owner invited successfully! An email has been sent.")
      setInviteName("")
      setInviteEmail("")
      setIsInviting(false)
      fetchTeam() // Refresh list
    } catch (err: any) {
      console.error("Invite error:", err)
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to invite Co-Owner")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (staffId: string) => {
    try {
      await apiClient.delete(`/owner/team/co-owner/${staffId}`)
      toast.success("Co-Owner removed successfully")
      setCoOwners(prev => prev.filter(c => c.staffId !== staffId))
    } catch (err: any) {
      console.error("Remove error:", err)
      toast.error(err.response?.data?.error || "Failed to remove Co-Owner")
    }
  }

  const handleAccessToggle = async (
    coOwner: TeamMember,
    area: ManagementAccessArea,
    enabled: boolean,
  ) => {
    if (!coOwner.staffId) return

    const current = coOwner.coOwnerRestrictions || []
    const nextRestrictions = enabled
      ? current.filter((restriction) => restriction !== area)
      : [...new Set([...current, area])]
    const accessKey = `${coOwner.staffId}:${area}`

    try {
      setSavingAccessKey(accessKey)
      const res = await apiClient.patch(`/owner/team/co-owner/${coOwner.staffId}/access`, {
        coOwnerRestrictions: nextRestrictions,
      })
      setCoOwners((members) => members.map((member) => (
        member.staffId === coOwner.staffId ? { ...member, ...res.data } : member
      )))
      toast.success(`${coOwner.name}'s access was updated`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update Co-Owner access")
    } finally {
      setSavingAccessKey(null)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">Loading team settings...</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-4">
          <Link href="/owner/settings" className="p-2 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Team & Access
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage business ownership and access hierarchy
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 mt-4">
        
        {/* Section: Access Hierarchy */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Access Hierarchy</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Roles that have access to the Owner Portal.
              </p>
            </div>
            {!isInviting && (
              <Button onClick={() => setIsInviting(true)} className="gap-2 font-bold rounded-xl h-10">
                <Plus className="w-4 h-4" />
                Invite Co-Owner
              </Button>
            )}
          </div>

          {/* Invite Form */}
          {isInviting && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Invite Co-Owner
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setIsInviting(false)} className="text-muted-foreground">Cancel</Button>
              </div>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. John Doe"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="email" 
                        required 
                        placeholder="john@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting} className="font-bold rounded-xl gap-2 min-w-[120px]">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Send Invite
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {/* Primary Owner Card */}
            {primaryOwner && (
              <div className="p-5 bg-card border-2 border-primary/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl uppercase">
                    {primaryOwner.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      {primaryOwner.name}
                      <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Primary Owner
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium">{primaryOwner.email}</p>
                  </div>
                </div>
                <div className="relative z-10 hidden md:block text-right">
                  <p className="text-xs text-muted-foreground font-semibold">Permissions</p>
                  <p className="text-sm font-bold text-foreground">Full Access</p>
                </div>
              </div>
            )}

            {/* Co-Owners */}
            {coOwners.map((co) => {
              const coOwnerKey = co.staffId || co.email
              const isCollapsed = collapsedCoOwners.has(coOwnerKey)
              return (
              <div key={coOwnerKey} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center font-bold text-xl uppercase">
                      {co.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground flex flex-wrap items-center gap-2">
                        {co.name}
                        <span className="bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-border">
                          Co-Owner
                        </span>
                        {co.accountStatus === "pending" && (
                          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                            Pending Invite
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium">{co.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(co.coOwnerRestrictions || []).length === 0
                          ? "All standard Co-Owner areas are enabled"
                          : `${(co.coOwnerRestrictions || []).length} area${(co.coOwnerRestrictions || []).length === 1 ? "" : "s"} restricted`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCoOwnerCollapsed(coOwnerKey)}
                      className="rounded-xl text-muted-foreground hover:text-foreground"
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? "Expand" : "Minimize"} access controls for ${co.name}`}
                      title={isCollapsed ? "Expand access controls" : "Minimize access controls"}
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                    </Button>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" title="Remove Co-Owner">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black">Remove Co-Owner?</AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-muted-foreground pt-2">
                          Are you sure you want to remove <strong>{co.name}</strong>? They will immediately lose access to the owner dashboard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="pt-6 gap-3">
                        <AlertDialogCancel className="rounded-2xl h-12 px-6 font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(co.staffId!)} className="rounded-2xl h-12 px-6 font-bold bg-destructive hover:bg-destructive/90 text-white">
                          Remove Co-Owner
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {!isCollapsed && <div className="p-5 grid gap-6 md:grid-cols-2">
                  {CO_OWNER_ACCESS_GROUPS.map((group) => (
                    <fieldset key={group.label} className="space-y-2">
                      <legend className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </legend>
                      {group.areas.map((area) => {
                        const accessKey = `${co.staffId}:${area.key}`
                        const enabled = !(co.coOwnerRestrictions || []).includes(area.key)
                        return (
                          <label key={area.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                            <span className="text-sm font-bold text-foreground">{area.label}</span>
                            <span className="flex items-center gap-2">
                              {savingAccessKey === accessKey && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={savingAccessKey !== null}
                                onChange={(event) => handleAccessToggle(co, area.key, event.target.checked)}
                                className="h-4 w-4 accent-primary"
                                aria-label={`${area.label} access for ${co.name}`}
                              />
                            </span>
                          </label>
                        )
                      })}
                    </fieldset>
                  ))}

                  <div className="space-y-2 md:col-span-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Primary Owner Only</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {["Manage Co-Owners", "Transfer Ownership", "Delete Business"].map((label) => (
                        <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm font-bold text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>}
              </div>
            )})}

            {coOwners.length === 0 && !isInviting && (
              <div className="p-8 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center bg-secondary/20">
                <Shield className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="font-bold text-lg mb-1">No Co-Owners</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  Invite trusted partners or managers as Co-Owners to help run your business operations.
                </p>
                <Button onClick={() => setIsInviting(true)} variant="outline" className="font-bold rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Invite Co-Owner
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Section: Operational Staff Notice */}
        <div className="mt-12 bg-secondary/30 border border-border rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center shrink-0">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">Looking for Operational Staff?</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xl">
              Waitstaff, Kitchen Staff, Bartenders, and Managers are managed in the Staff Management section. They have restricted access to specific operational tools (like the POS or Kitchen Display) and cannot access this Owner Portal.
            </p>
            <Link href="/owner/staff">
              <Button variant="secondary" className="font-bold rounded-xl gap-2 text-xs">
                Go to Staff Management
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
