"use client";

import { startTransition, useActionState, useRef, type FormEvent } from "react";

// Igual que useActionState, pero el formulario conserva lo escrito cuando la acción devuelve un
// error (React 19 vacía los formularios con `action` después de cada envío). Si la acción sale
// bien, el formulario se limpia como antes. Se usa con `<form onSubmit={submit}>`.
export function useFormActionState<State>(action: (state: Awaited<State>, data: FormData) => State | Promise<State>, initialState: Awaited<State>) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch, pending] = useActionState(async (previous: Awaited<State>, data: FormData) => {
    const next = await action(previous, data);
    const failed = Boolean(next && typeof next === "object" && "error" in next && (next as { error?: unknown }).error);
    if (!failed) formRef.current?.reset();
    return next;
  }, initialState);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    // El botón pulsado viaja con el formulario (p. ej. «Asistiré» / «No asistiré»).
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(data));
  }

  return [state, submit, pending] as const;
}
