"use client"

import { useEffect, useState } from "react"
import { X, AlertCircle } from "lucide-react"
import { useCartStore } from "@/store/cart-store"

const COMMON_ALLERGIES = ["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Shellfish", "Fish", "Soy", "Wheat/Gluten", "Sesame"]
const MAX_SPECIAL_NOTE_CHARACTERS = 50

function limitToCharacterCount(value: string) {
  return value.slice(0, MAX_SPECIAL_NOTE_CHARACTERS)
}

export default function AllergySelector() {
  const { allergies, specialNotes, setAllergies, setSpecialNotes } = useCartStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const specialNotesCharacterCount = specialNotes.length

  useEffect(() => {
    const limitedNotes = limitToCharacterCount(specialNotes)
    if (limitedNotes !== specialNotes) {
      setSpecialNotes(limitedNotes)
    }
  }, [setSpecialNotes, specialNotes])

  const toggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      setAllergies(allergies.filter((a) => a !== allergy))
    } else {
      setAllergies([...allergies, allergy])
    }
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between mb-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs text-muted-foreground/60 font-normal uppercase tracking-wide">Optional</span>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[var(--brand-primary,var(--color-primary))]" />
            <h3 className="font-semibold text-foreground">Special Instructions</h3>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {isExpanded ? "Hide" : allergies.length > 0 ? `${allergies.length} selected` : "Add"}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Allergy Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Select any allergies to avoid:</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGIES.map((allergy) => (
                <button
                  key={allergy}
                  onClick={() => toggleAllergy(allergy)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                    allergies.includes(allergy)
                      ? "bg-[var(--brand-primary,var(--color-primary))] text-white shadow-md"
                      : "bg-background text-foreground hover:bg-secondary border-border"
                  }`}
                >
                  {allergies.includes(allergy) && <X className="w-3 h-3 inline mr-1" />}
                  {allergy}
                </button>
              ))}
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <label htmlFor="special-notes" className="text-sm text-muted-foreground block mb-2">
              Special requests or dietary notes:
            </label>
            <textarea
              id="special-notes"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(limitToCharacterCount(e.target.value))}
              maxLength={MAX_SPECIAL_NOTE_CHARACTERS}
              aria-describedby="special-notes-character-limit"
              placeholder="E.g., No onions, extra sauce, low sodium..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 resize-none"
            />
            <p
              id="special-notes-character-limit"
              className={`mt-2 text-right text-xs ${specialNotesCharacterCount === MAX_SPECIAL_NOTE_CHARACTERS ? "text-[var(--brand-primary,var(--color-primary))]" : "text-muted-foreground"}`}
              aria-live="polite"
            >
              {specialNotesCharacterCount} of {MAX_SPECIAL_NOTE_CHARACTERS} characters used
            </p>
          </div>

          {/* Summary */}
          {(allergies.length > 0 || specialNotes) && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Your preferences will be shared with the kitchen</p>
              {allergies.length > 0 && (
                <p className="text-sm text-foreground">
                  <strong>Allergies:</strong> {allergies.join(", ")}
                </p>
              )}
              {specialNotes && (
                <p className="text-sm text-foreground mt-1">
                  <strong>Notes:</strong> {specialNotes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
