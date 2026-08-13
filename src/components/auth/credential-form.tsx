import type { PropsWithChildren } from "react";
import { View } from "react-native";

interface CredentialFormProps extends PropsWithChildren {
  name?: string;
  onSubmit: () => void;
}

export function CredentialForm({ children }: CredentialFormProps) {
  return <View className="gap-5">{children}</View>;
}
