import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="font-display text-6xl font-bold text-primary/30">404</h1>
        <p className="font-display text-xl font-semibold">Page not found</p>
        <p className="text-muted-foreground text-sm">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
