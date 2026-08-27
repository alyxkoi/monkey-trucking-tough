import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <section className="bg-industrial py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h1 className="font-heading text-h2 text-white md:text-h1">{title}</h1>
          <p className="mt-3 text-small text-gravel">Last updated: {updated}</p>
        </div>
      </section>
      <section className="bg-background py-12 md:py-16">
        <article className="container mx-auto max-w-4xl px-4 text-foreground">
          <div className="space-y-10 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {children}
          </div>
        </article>
      </section>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-heading text-h3 text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-primary">{children}</ul>;
}
