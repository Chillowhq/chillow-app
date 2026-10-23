"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { Input } from "@/components/ui/input"
import type {
  ServicePointModalProps,
} from "@/types/service-point"
import {
  formatRestaurantServicePointLabel,
  getRestaurantServicePointDefaultValues,
  restaurantServicePointSchema,
  toRestaurantServicePointPayload,
  type RestaurantServicePointFormValues,
} from "./RestaurantServicePointModal.validation"
import {
  ServicePointModalFoundation,
} from "./ServicePointModalFoundation"
import {
  classifyFormApiError,
  type FormApiError,
} from "@/lib/forms/api-error"

export function RestaurantServicePointModal({
  isOpen,
  onClose,
  isEditing,
  initialData,
  onSave,
  term,
  servicePointType = "table",
}: ServicePointModalProps & { servicePointType?: "table" | "booth" | "other" }) {
  const [formError, setFormError] = useState<FormApiError | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RestaurantServicePointFormValues>({
    resolver: zodResolver(restaurantServicePointSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getRestaurantServicePointDefaultValues(initialData),
  })

  useEffect(() => {
    if (!isOpen) return
    reset(getRestaurantServicePointDefaultValues(initialData))
    setFormError(null)
  }, [initialData, isOpen, reset])

  async function handleSave(values: RestaurantServicePointFormValues) {
    setFormError(null)

    try {
      await onSave(toRestaurantServicePointPayload(values, servicePointType))
      onClose()
    } catch (error) {
      setFormError(classifyFormApiError(error, "Failed to save service point"))
    }
  }

  const labelRegistration = register("label")
  const codeRegistration = register("code")
  const capacityRegistration = register("capacity")

  const clearFormError = () => setFormError(null)

  return (
    <ServicePointModalFoundation
      isOpen={isOpen}
      onClose={onClose}
      isEditing={isEditing}
      term={term}
      description={
        <>Fill in the details below to {isEditing ? "update" : "create"} a service point.</>
      }
      formError=""
      isSaving={isSubmitting}
      onSubmit={() => void handleSubmit(handleSave)()}
    >
      <div className="space-y-4" aria-busy={isSubmitting}>
        <Field id="restaurant-service-point-label" label="Display Label" required error={errors.label?.message}>
          {(controlProps) => (
            <Input
              {...labelRegistration}
              {...controlProps}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                event.target.value = formatRestaurantServicePointLabel(event.target.value)
                labelRegistration.onChange(event)
                clearFormError()
              }}
              placeholder="Table 10"
            />
          )}
        </Field>

        <Field id="restaurant-service-point-code" label="Short Code" required error={errors.code?.message}>
          {(controlProps) => (
            <Input
              {...codeRegistration}
              {...controlProps}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                codeRegistration.onChange(event)
                clearFormError()
              }}
              placeholder="T12"
            />
          )}
        </Field>

        <Field id="restaurant-service-point-capacity" label="Capacity" error={errors.capacity?.message}>
          {(controlProps) => (
            <Input
              {...capacityRegistration}
              {...controlProps}
              type="number"
              min="1"
              disabled={isSubmitting}
              onChange={(event) => {
                capacityRegistration.onChange(event)
                clearFormError()
              }}
              placeholder="e.g. 4"
            />
          )}
        </Field>

        {formError ? (
          <FormNotice tone={formError.kind === "rate_limit" ? "warning" : "error"}>
            {formError.message}
          </FormNotice>
        ) : null}
      </div>
    </ServicePointModalFoundation>
  )
}
