"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Mail, X } from "lucide-react"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { Input } from "@/components/ui/input"
import { classifyFormApiError, type FormApiError } from "@/lib/forms/api-error"
import {
    getReceiptModalDefaultValues,
    toReceiptModalSubmission,
    receiptModalSchema,
    type ReceiptModalFormValues,
} from "./receipt-modal.validation"

interface ReceiptModalProps {
    isOpen: boolean
    onClose: () => void
    onSend: (email: string, marketingConsent: boolean) => void | Promise<void>
    onDecline: () => void
    defaultEmail?: string
    businessName: string
}

export default function ReceiptModal({ isOpen, onSend, onDecline, defaultEmail = "", businessName }: ReceiptModalProps) {
    const [formError, setFormError] = useState<FormApiError | null>(null)
    const submissionInFlight = useRef(false)
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ReceiptModalFormValues>({
        resolver: zodResolver(receiptModalSchema),
        mode: "onSubmit",
        reValidateMode: "onChange",
        shouldFocusError: true,
        defaultValues: getReceiptModalDefaultValues(defaultEmail),
    })
    const emailRegistration = register("email")
    const marketingConsentRegistration = register("marketingConsent")

    useEffect(() => {
        if (isOpen) {
            reset(getReceiptModalDefaultValues(defaultEmail))
            setFormError(null)
        }
    }, [defaultEmail, isOpen, reset])

    if (!isOpen) return null

    const submitReceipt = async (values: ReceiptModalFormValues) => {
        if (submissionInFlight.current) return

        submissionInFlight.current = true
        setFormError(null)

        try {
            const submission = toReceiptModalSubmission(values)
            await onSend(submission.email, submission.marketingConsent)
        } catch (error) {
            const fallbackMessage = error instanceof Error && error.message
                ? error.message
                : "Failed to send receipt."
            setFormError(classifyFormApiError(error, fallbackMessage))
        } finally {
            submissionInFlight.current = false
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 backdrop-blur-md">
            <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 relative">
                    <button
                        onClick={onDecline}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg p-1 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-16 h-16 bg-gradient-to-br from-[var(--brand-gradient-from,var(--color-primary))]/20 to-[var(--brand-gradient-to,var(--color-accent))]/10 rounded-full flex items-center justify-center mb-5 mx-auto shadow-lg">
                        <Mail className="w-8 h-8 text-[var(--brand-primary,var(--color-primary))]" />
                    </div>
                    <h2 className="text-2xl font-black text-center text-foreground mb-2">Where should we send your receipt?</h2>
                    <p className="text-sm text-center text-foreground/70 mb-8 leading-relaxed">
                        We'll send your receipt and order confirmation to this email.
                    </p>
                    <form
                        onSubmit={(event) => void handleSubmit(submitReceipt)(event)}
                        className="space-y-4"
                        noValidate
                        aria-busy={isSubmitting}
                    >
                        <Field
                            id="receipt-email"
                            label="Email address"
                            required
                            error={errors.email?.message}
                        >
                            {(controlProps) => (
                                <Input
                                    {...emailRegistration}
                                    {...controlProps}
                                    type="email"
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,var(--color-primary))]/50 focus:border-[var(--brand-primary,var(--color-primary))] transition-all text-foreground placeholder-muted-foreground font-medium"
                                    required
                                    autoFocus
                                    disabled={isSubmitting}
                                    onChange={(event) => {
                                        emailRegistration.onChange(event)
                                        setFormError(null)
                                    }}
                                />
                            )}
                        </Field>
                        {formError ? (
                            <FormNotice tone={formError.kind === "rate_limit" ? "warning" : "error"}>
                                {formError.message}
                            </FormNotice>
                        ) : null}
                        <label className="flex items-start gap-3 mt-4 mb-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center mt-0.5">
                                <input
                                    type="checkbox"
                                    {...marketingConsentRegistration}
                                    disabled={isSubmitting}
                                    className="peer appearance-none w-5 h-5 border-2 border-border rounded-md checked:bg-[var(--brand-primary,var(--color-primary))] checked:border-[var(--brand-primary,var(--color-primary))] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,var(--color-primary))]/50"
                                />
                                <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
                                Send me offers and rewards from {businessName}
                            </span>
                        </label>
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="group relative w-full overflow-hidden bg-gradient-to-r from-[var(--brand-gradient-from,var(--color-primary))] to-[var(--brand-gradient-to,var(--color-accent))] hover:shadow-lg text-white py-3 rounded-xl font-bold transition-all active:scale-95"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <span className="relative">{isSubmitting ? "Sending..." : "I want a receipt"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={onDecline}
                                className="w-full bg-secondary hover:bg-secondary/80 text-foreground py-3 rounded-xl font-bold transition-all border border-border/50"
                            >
                                I dont want a receipt
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
