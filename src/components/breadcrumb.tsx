import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="inline-flex w-fit items-center rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.label}>
          {item.href ? <Link className="font-medium hover:text-primary" href={item.href}>{item.label}</Link> : <span className="font-medium text-foreground">{item.label}</span>}
          {index < items.length - 1 && <span className="mx-2 text-border">/</span>}
        </span>
      ))}
    </nav>
  );
}
