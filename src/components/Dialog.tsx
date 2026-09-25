"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  isOpen: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native modal <dialog>: the browser traps focus, makes the page inert and closes on Esc. */
export function Dialog({
  isOpen,
  eyebrow,
  title,
  onClose,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={headingId}
      onClose={onClose}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </header>
      {isOpen && children}
    </dialog>
  );
}
