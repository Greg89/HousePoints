import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ClientErrorReporter } from "@/components/ClientErrorReporter";
import "./globals.css";

export const metadata: Metadata = {
  title: "HousePoints",
  description: "House-based team scoring app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ClientErrorReporter />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "rounded-2xl border bg-card text-card-foreground shadow-xl shadow-primary/10",
              title: "font-semibold text-foreground",
              description: "text-muted-foreground",
              actionButton: "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground",
              cancelButton: "rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
