"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adminDeletePostUpload } from "@/app/(app)/dashboard/actions";

interface Props {
  postId: string;
  postLabel?: string | null;
}

/**
 * Admin-only delete button used on the /team/[id] employee-detail page.
 * Mirrors the visual treatment of `DeletePostButton` (the employee-side
 * delete) but hits `adminDeletePostUpload` which bypasses the
 * current-period restriction.
 */
export function AdminDeletePostButton({ postId, postLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await adminDeletePostUpload(postId);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete this upload"
          title="Delete this upload"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this upload?</DialogTitle>
          <DialogDescription asChild>
            <div>
              {postLabel ? (
                <span className="block break-all text-foreground text-xs font-mono leading-relaxed bg-muted/50 rounded px-2 py-1.5">
                  {postLabel}
                </span>
              ) : null}
              <p className="mt-3">
                This removes the post from the employee&apos;s upload history and
                recalculates their totals. The deletion is logged in the activity
                feed with your admin email. This action cannot be undone.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete post
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
