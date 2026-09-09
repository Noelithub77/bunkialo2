type BrowserPasswordCredential = Credential & {
  password: string;
};

type PasswordCredentialConstructor = new (data: {
  id: string;
  name?: string;
  password: string;
}) => BrowserPasswordCredential;

type CredentialContainerWithPasswords = CredentialsContainer & {
  get(options?: CredentialRequestOptions & { password?: boolean }): Promise<Credential | null>;
};

const getPasswordCredentialConstructor = (): PasswordCredentialConstructor | null => {
  const value = (globalThis as typeof globalThis & {
    PasswordCredential?: PasswordCredentialConstructor;
  }).PasswordCredential;
  return value ?? null;
};

export const offerWebCredential = async (credentials: {
  identifier: string;
  name: string;
  password: string;
}): Promise<void> => {
  const PasswordCredential = getPasswordCredentialConstructor();
  if (!PasswordCredential || !navigator.credentials?.store) return;

  try {
    const storeRequest = navigator.credentials.store(
      new PasswordCredential({
        id: credentials.identifier,
        name: credentials.name,
        password: credentials.password,
      }),
    );
    // Password-manager UI must never block the app's authentication flow.
    void storeRequest.catch(() => undefined);
  } catch {
    // Browser autofill remains available when the programmatic API is blocked.
  }
};

export const getWebCredential = async (): Promise<{
  identifier: string;
  password: string;
} | null> => {
  const credentials = navigator.credentials as CredentialContainerWithPasswords | undefined;
  if (!credentials?.get || !getPasswordCredentialConstructor()) return null;

  try {
    const credential = await credentials.get({ mediation: "optional", password: true });
    if (!credential || !("password" in credential)) return null;
    const passwordCredential = credential as BrowserPasswordCredential;
    return { identifier: passwordCredential.id, password: passwordCredential.password };
  } catch {
    return null;
  }
};

export const preventAutomaticWebSignIn = async (): Promise<void> => {
  try {
    await navigator.credentials?.preventSilentAccess?.();
  } catch {
    // Some browsers expose the method but do not implement password credentials.
  }
};
