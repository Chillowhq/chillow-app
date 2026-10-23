import { ReactNode } from "react"

// Bootstrap layout — no persistent UI shells needed here.
// MenuButton lives in the /table layout which is the real customer app.
export default function QRBootstrapLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
