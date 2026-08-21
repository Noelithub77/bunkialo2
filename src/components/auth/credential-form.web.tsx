import type { FormEvent, PropsWithChildren } from "react";

interface CredentialFormProps extends PropsWithChildren {
  name?: string;
  onSubmit: () => void;
}

export function CredentialForm({ children, name, onSubmit }: CredentialFormProps) {
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      aria-label="Sign in"
      autoComplete="on"
      method="post"
      name={name}
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {children}
      <button
        aria-hidden="true"
        style={{
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          position: "absolute",
          width: 1,
        }}
        tabIndex={-1}
        type="submit"
      >
        Sign in
      </button>
    </form>
  );
}
