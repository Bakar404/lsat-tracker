import { useState } from "react";
import Modal from "./Modal.jsx";
import { buttonDanger, buttonPrimary, buttonSecondary } from "./styles.js";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      footer={
        <>
          <button
            type="button"
            className={buttonSecondary}
            onClick={onCancel}
            disabled={busy}
            data-autofocus
          >
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? buttonDanger : buttonPrimary}
            onClick={confirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
