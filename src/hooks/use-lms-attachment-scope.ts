import { useEffect, useState } from "react";
import { getCredentials } from "@/services/auth/lms-auth";
import { useAuthStore } from "@/stores/auth-store";
// Do not put private previews in a shared anonymous cache while auth is hydrating.
export function useLmsAttachmentScope(): string | null {
  const username = useAuthStore((state) => state.username);
  const [scope, setScope] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getCredentials().then((credentials) => {
      if (!cancelled) setScope(credentials?.username || null);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);
  return scope;
}
