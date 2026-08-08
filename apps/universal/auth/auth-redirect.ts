import * as Linking from "expo-linking";

export function getAuthRedirect(path: "entrar" | "recuperar-senha"): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/${path}`;
  }

  return Linking.createURL(path);
}
