import { Toaster } from "sonner";
import { useTheme } from "../theme-context";

export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={theme}
      toastOptions={{ duration: 4000 }}
    />
  );
}
