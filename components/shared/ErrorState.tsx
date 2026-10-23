import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ErrorStateProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
  descriptionClassName?: string
}

export function ErrorState({
  title,
  description,
  icon,
  action,
  className,
  descriptionClassName,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        className,
      )}
    >
      {icon}
      <h2 className={cn("font-bold text-foreground", icon && "mt-4 text-lg")}>
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-1 max-w-md text-sm text-muted-foreground",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      {action}
    </section>
  )
}
