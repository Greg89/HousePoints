import Link from "next/link";
import type { ReactNode } from "react";

type PublicInfoPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function PublicInfoPage({
  eyebrow,
  title,
  intro,
  children,
}: PublicInfoPageProps) {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-border pb-8">
          <Link
            href="/"
            className="text-sm font-semibold text-primary hover:underline"
          >
            HousePoints
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {intro}
          </p>
        </header>

        <div className="space-y-8 py-8 text-base leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
          <span aria-hidden="true" className="mx-3">
            ·
          </span>
          <Link href="/support" className="hover:text-foreground hover:underline">
            Support
          </Link>
        </footer>
      </article>
    </main>
  );
}
