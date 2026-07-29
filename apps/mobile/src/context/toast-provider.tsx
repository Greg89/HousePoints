import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";

type ToastVariant = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (options: { message: string; variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback(
    (options: { message: string; variant?: ToastVariant }) => {
      setToast({
        id: Date.now(),
        message: options.message,
        variant: options.variant ?? "info",
      });
    },
    [],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const handle = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          style={[styles.toast, styles[toast.variant]]}
          pointerEvents="none"
        >
          <Text style={styles.text}>{toast.message}</Text>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 48,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  info: { backgroundColor: "#1e293b" },
  success: { backgroundColor: "#166534" },
  error: { backgroundColor: "#991b1b" },
  text: { color: "#ffffff", fontSize: 15, fontWeight: "500" },
});
