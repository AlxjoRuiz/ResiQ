"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Confirmación común para borrar, anular, cancelar, quitar o suspender (15/11/2026, pedido de Alejandro): un aviso
// rojo en el centro de la pantalla con el fondo desenfocado, con «Sí, …» y «No, volver».
// Solo cambia el aspecto: el botón sigue dentro del mismo formulario y, al confirmar, envía ese formulario tal como
// lo hacía antes (con su nombre y valor, si los tenía). Si el formulario tiene campos obligatorios vacíos, primero los
// señala el navegador y no se abre el aviso.
type ButtonProps = { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon"; className?: string };

export function ConfirmButton({ title, message, confirmLabel, cancelLabel = "No, volver", children, disabled, name, value, variant = "outline", size = "sm", className }: ButtonProps & {
  title: string; message: ReactNode; confirmLabel: string; cancelLabel?: string; children: ReactNode; disabled?: boolean; name?: string; value?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  function ask() {
    const form = triggerRef.current?.form;
    if (form && !form.reportValidity()) return;
    setOpen(true);
  }
  function confirm() {
    setOpen(false);
    const form = submitRef.current?.form;
    if (form && submitRef.current) form.requestSubmit(submitRef.current);
  }

  return <>
    <Button ref={triggerRef} type="button" variant={variant} size={size} className={className} disabled={disabled} onClick={ask}>{children}</Button>
    {/* Botón oculto que envía el formulario con el mismo nombre y valor que tenía el botón original. */}
    <button ref={submitRef} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden="true" />
    {open && <ConfirmDialog title={title} message={message} confirmLabel={confirmLabel} cancelLabel={cancelLabel} onConfirm={confirm} onCancel={() => setOpen(false)} />}
  </>;
}

/** El aviso en sí: también sirve para confirmar acciones que no son un formulario. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "No, volver", onConfirm, onCancel }: { title: string; message: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Foco en «No, volver» (lo más seguro), Escape cierra y la página de atrás no se desplaza mientras está abierto.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onCancel]);

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo" aria-describedby="confirmar-mensaje" className="w-full max-w-md overflow-hidden rounded-2xl border border-urgent/30 bg-white text-left shadow-2xl">
      <div className="flex items-start gap-4 bg-urgent/5 p-5 sm:p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-urgent/12 text-urgent"><TriangleAlert size={22} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="confirmar-titulo" className="text-lg font-semibold text-urgent">{title}</h2>
          <div id="confirmar-mensaje" className="mt-2 text-sm leading-6 text-slate-700">{message}</div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-urgent/15 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="button" className="bg-urgent text-white hover:bg-urgent/90" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>, document.body);
}
