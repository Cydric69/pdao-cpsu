"use client";

import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface IssueCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApplication: any;
  cardIdInput: string;
  setCardIdInput: (value: string) => void;
  cardIdError: string;
  setCardIdError: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function IssueCardModal({
  open,
  onOpenChange,
  selectedApplication,
  cardIdInput,
  setCardIdInput,
  cardIdError,
  setCardIdError,
  isSubmitting,
  onSubmit,
}: IssueCardModalProps) {
  const cardIdInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open && cardIdInputRef.current) {
      setTimeout(() => cardIdInputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          onOpenChange(false);
          setCardIdInput("");
          setCardIdError("");
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Issue PWD ID Card
          </DialogTitle>
        </DialogHeader>

        {selectedApplication && (
          <div className="space-y-5 py-1">
            {/* Applicant summary */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-emerald-700">
                  {selectedApplication.first_name?.charAt(0) ?? "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {selectedApplication.first_name}{" "}
                  {selectedApplication.last_name}
                  {selectedApplication.suffix &&
                    ` ${selectedApplication.suffix}`}
                </p>
                <p className="text-xs text-slate-500">
                  App #{selectedApplication.application_id}
                </p>
              </div>
            </div>

            {/* Card ID input */}
            <div className="space-y-2">
              <Label
                htmlFor="card-id-input"
                className="text-sm font-semibold text-slate-700"
              >
                Card ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="card-id-input"
                ref={cardIdInputRef}
                value={cardIdInput}
                onChange={(e) => {
                  setCardIdInput(e.target.value);
                  if (cardIdError) setCardIdError("");
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isSubmitting &&
                    cardIdInput.trim()
                  ) {
                    onSubmit();
                  }
                }}
                placeholder="e.g. 06-4511-001-1234567"
                className={`font-mono text-base h-11 ${
                  cardIdError
                    ? "border-red-400 focus-visible:ring-red-400"
                    : "focus-visible:ring-emerald-400"
                }`}
                disabled={isSubmitting}
              />
              {cardIdError ? (
                <p className="text-xs text-red-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {cardIdError}
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Enter the ID exactly as printed on the physical card. Press
                  Enter to confirm.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setCardIdInput("");
              setCardIdError("");
            }}
            disabled={isSubmitting}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !cardIdInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Issuing…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Issue Card
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
