import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ConfirmContext = createContext(null);

const DEFAULTS = {
  title: "Are you sure?",
  description: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  destructive: false,
};

export function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(DEFAULTS);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    setOpts({ ...DEFAULTS, ...options });
    setOpen(true);
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const finish = (result) => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>{opts.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finish(true)}
              className={opts.destructive ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            >
              {opts.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
