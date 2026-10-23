"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { Lock, ThumbsUp, CheckCircle2 } from "lucide-react"
import { apiClient } from "@/lib/axios-config"
import { classifyFormApiError, type FormApiError } from "@/lib/forms/api-error"
import { ensureSessionId } from "@/lib/guest-session"
import { motion, AnimatePresence } from "framer-motion"
import {
  feedbackModalSchema,
  getFeedbackModalDefaultValues,
  isFeedbackAlreadySubmittedConflict,
  toFeedbackPayload,
  type FeedbackModalFormValues,
} from "./feedback-modal.validation"

interface FeedbackModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  orderId: string
  businessId: string
  onSubmitted?: () => void
  /** Optional reservation URL for the "Book your next visit" CTA. */
  reservationUrl?: string
  /** Optional business display name shown in the success state. */
  businessName?: string
}

const RATINGS = [
  { value: 1, label: "Terrible", emoji: "😡", color: "bg-rose-50", ring: "ring-rose-100" },
  { value: 2, label: "Bad", emoji: "😕", color: "bg-orange-50", ring: "ring-orange-100" },
  { value: 3, label: "Okay", emoji: "😐", color: "bg-yellow-50", ring: "ring-yellow-100" },
  { value: 4, label: "Good", emoji: "😊", color: "bg-green-50", ring: "ring-green-100" },
  { value: 5, label: "Excellent", emoji: "🤩", color: "bg-emerald-50", ring: "ring-emerald-100" }
]

export function FeedbackModal({ isOpen, setIsOpen, orderId, businessId, onSubmitted, reservationUrl, businessName }: FeedbackModalProps) {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)
  const [showGooglePrompt, setShowGooglePrompt] = useState(false)
  const [formError, setFormError] = useState<FormApiError | null>(null)
  const submissionInFlight = useRef(false)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackModalFormValues>({
    resolver: zodResolver(feedbackModalSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getFeedbackModalDefaultValues(),
  })
  const rating = useWatch({ control, name: "rating" })
  const commentRegistration = register("comment")

  const submitFeedback = async (values: FeedbackModalFormValues) => {
    if (submissionInFlight.current) return

    submissionInFlight.current = true
    setFormError(null)

    try {
      await apiClient.post(
        "/feedback",
        toFeedbackPayload(values, {
          orderId,
          businessId,
          sessionId: ensureSessionId(),
        }),
      )

      handleSuccess(values.rating)
    } catch (error) {
      if (isFeedbackAlreadySubmittedConflict(error)) {
        handleSuccess(values.rating)
        return
      }
      const fallbackMessage = error instanceof Error && error.message
        ? error.message
        : "An error occurred."
      setFormError(classifyFormApiError(error, fallbackMessage))
    } finally {
      submissionInFlight.current = false
    }
  }

  const handleSuccess = (submittedRating: number) => {
    setSubmitted(true)
    
    // If a reservationUrl is provided (restaurant flow), show the
    // "Book your next visit" success state. Do NOT call onSubmitted yet —
    // let the user see the success state and choose to rebook or close.
    if (reservationUrl) {
      return
    }

    // Non-restaurant flow (hotel or no reservation URL): use the existing
    // Google Review prompt / auto-close behaviour, and notify the parent.
    if (onSubmitted) onSubmitted()

    if (submittedRating >= 4) {
      setShowGooglePrompt(true)
    } else {
      setTimeout(() => {
        setIsOpen(false)
      }, 3000)
    }
  }

  /** Called when the user dismisses the restaurant success state. */
  const handleDismissSuccess = () => {
    if (onSubmitted) onSubmitted()
    setIsOpen(false)
  }

  const activeRating = RATINGS.find(r => r.value === rating)

  // Subtitle/Prompt text based on rating
  const feedbackPrompt = rating >= 4 ? "What did you love?" : (rating > 0 ? "What could we improve?" : "Tap an emoji to rate your experience.")
  const commentPlaceholder = rating >= 4 ? "Food, service, atmosphere..." : "Tell us what went wrong..."

  if (submitted) {
    // Restaurant success state with rebooking CTA
    if (reservationUrl) {
      return (
        <Dialog open={isOpen} onOpenChange={handleDismissSuccess}>
          <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] text-center p-8 border-none shadow-2xl rounded-[32px] bg-white outline-none">
            <div className="flex flex-col items-center gap-4 py-4">
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2 shadow-inner"
              >
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </motion.div>
              <DialogTitle className="text-3xl font-extrabold tracking-tight text-gray-900">Thank you for your feedback</DialogTitle>
              <p className="text-gray-500 font-medium text-sm">
                Your feedback has been sent to {businessName || "the business"}.
              </p>
              
              <Button 
                className="w-full mt-6 rounded-2xl h-14 font-bold bg-black text-white hover:bg-black/80 shadow-xl shadow-black/20"
                onClick={() => {
                  if (onSubmitted) onSubmitted()
                  setIsOpen(false)
                  router.push(reservationUrl)
                }}
              >
                Book your next visit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    // Non-restaurant: existing Google Review / thank-you state
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] text-center p-8 border-none shadow-2xl rounded-[32px] bg-white outline-none">
          {showGooglePrompt ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2 shadow-inner"
              >
                <ThumbsUp className="w-10 h-10 text-green-600" />
              </motion.div>
              <DialogTitle className="text-3xl font-extrabold tracking-tight text-gray-900">Thank you! ❤️</DialogTitle>
              <p className="text-gray-500 font-medium text-sm">We are so glad you enjoyed your experience.</p>
              <p className="text-sm font-bold mt-2 text-gray-800">Would you mind leaving us a quick Google Review?</p>
              
              <div className="flex gap-3 mt-6 w-full">
                <Button variant="outline" className="flex-1 rounded-2xl h-14 font-bold border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setIsOpen(false)}>
                  No thanks
                </Button>
                <Button className="flex-1 bg-black hover:bg-black/80 text-white rounded-2xl h-14 font-bold shadow-xl shadow-black/20" onClick={() => {
                  window.open("https://google.com", "_blank")
                  setIsOpen(false)
                }}>
                  Leave Review
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2 text-4xl shadow-inner"
              >
                🙏
              </motion.div>
              <DialogTitle className="text-3xl font-extrabold tracking-tight text-gray-900">Thank you!</DialogTitle>
              <p className="text-gray-500 font-medium text-sm">Your feedback helps us improve.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={`sm:max-w-md w-[calc(100%-2rem)] p-0 border-none shadow-2xl rounded-[32px] overflow-hidden transition-colors duration-500 outline-none ${activeRating ? activeRating.color : "bg-white"}`}>
        <div className="flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="pt-6 pb-4 px-6 flex flex-col items-center shrink-0">
            <AnimatePresence mode="popLayout">
              {activeRating ? (
                <motion.div
                  key="active-emoji"
                  initial={{ scale: 0.5, y: 20, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.5, y: -20, opacity: 0 }}
                  className={`w-20 h-20 bg-white rounded-full flex items-center justify-center text-5xl shadow-xl ring-4 mb-4 ${activeRating.ring}`}
                >
                  {activeRating.emoji}
                </motion.div>
              ) : (
                <motion.div
                  key="default-icon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-4xl shadow-sm mb-4"
                >
                  👋
                </motion.div>
              )}
            </AnimatePresence>
            
            <DialogTitle className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">How was it?</DialogTitle>
            <p className="text-sm font-medium text-gray-500">{rating === 0 ? "Tap an emoji to rate your visit." : feedbackPrompt}</p>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" aria-busy={isSubmitting}>
            {/* Rating Selector */}
            <Controller
              control={control}
              name="rating"
              render={({ field }) => (
                <fieldset
                  aria-describedby={errors.rating ? "feedback-rating-error" : undefined}
                  aria-invalid={errors.rating ? true : undefined}
                >
                  <legend className="sr-only">Choose a rating for your experience</legend>
                  <div className="flex justify-between items-center gap-2 mb-8 mt-2" role="group" aria-label="Choose a rating for your experience">
                    {RATINGS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        ref={r.value === 1 ? field.ref : undefined}
                        onBlur={field.onBlur}
                        onClick={() => {
                          field.onChange(r.value)
                          setFormError(null)
                        }}
                        disabled={isSubmitting}
                        aria-label={r.label}
                        aria-pressed={rating === r.value}
                        className="flex flex-col items-center gap-2 group focus:outline-none"
                      >
                        <motion.div
                          animate={{
                            scale: rating === r.value ? 1.2 : 1,
                            opacity: rating === 0 || rating === r.value ? 1 : 0.4
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-4xl sm:text-5xl drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300"
                        >
                          {r.emoji}
                        </motion.div>
                        <span className={`text-[10px] sm:text-xs font-semibold transition-colors ${rating === r.value ? "text-gray-900" : "text-gray-400"}`}>
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            />
            {errors.rating ? (
              <p id="feedback-rating-error" className="text-sm text-red-500 text-center font-medium mt-4" aria-live="polite">
                {errors.rating.message}
              </p>
            ) : null}

            <AnimatePresence>
              {rating > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-5 overflow-hidden"
                >
                  {/* Comment Area */}
                  <Field
                    id="feedback-comment"
                    label={<span className="sr-only">Feedback comment</span>}
                  >
                    {(controlProps) => (
                      <textarea
                        {...commentRegistration}
                        {...controlProps}
                        className="w-full h-24 p-4 text-sm rounded-2xl border-none bg-white shadow-inner shadow-black/5 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/5 resize-none"
                        placeholder={commentPlaceholder}
                        maxLength={500}
                        disabled={isSubmitting}
                        onChange={(event) => {
                          commentRegistration.onChange(event)
                          setFormError(null)
                        }}
                      />
                    )}
                  </Field>

                </motion.div>
              )}
            </AnimatePresence>

            {formError ? (
              <FormNotice className="mt-4" tone={formError.kind === "rate_limit" ? "warning" : "error"}>
                {formError.message}
              </FormNotice>
            ) : null}

            <Button 
              className="w-full h-14 rounded-2xl text-base font-bold text-white hover:brightness-90 shadow-lg mt-6" 
              style={{ backgroundColor: 'var(--brand-secondary, #2B304C)' }}
              onClick={() => void handleSubmit(submitFeedback)()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Submit Feedback"}
            </Button>
          </div>

          {/* Footer */}
          <div className="shrink-0 py-4 border-t border-black/5 bg-white/50 backdrop-blur-sm flex justify-center items-center gap-2 text-xs font-medium text-gray-400">
            <Lock className="w-3 h-3" />
            Your feedback is anonymous and helps us improve.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
