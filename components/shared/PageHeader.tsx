import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  leading?: ReactNode
  action?: ReactNode
  className?: string
  titleClassName?: string
  descriptionClassName?: string
}

export function PageHeader({
  title,
  description,
  leading,
  action,
  className,
  titleClassName,
  descriptionClassName,
}: PageHeaderProps) {
  return (
    <div className={cn(className)}>
      {leading}
      <div>
        <h1
          className={cn(
            "text-2xl font-black tracking-tight text-foreground",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-0.5 text-sm text-muted-foreground",
              descriptionClassName,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
