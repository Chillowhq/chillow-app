import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ReservationDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isBusy,
  isDeleting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isBusy: boolean
  isDeleting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive Reservation</DialogTitle>
          <DialogDescription>
            Remove this terminal reservation from operational views? Its record
            will remain stored for reporting and audit history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isBusy}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Archiving...
              </>
            ) : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
