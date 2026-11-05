"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getToken, setToken } from "@/lib/api";

const NAV = [
  { href: "/cases", label: "Disputes" },
  { href: "/orders", label: "Orders" },
  { href: "/issues", label: "Agent issues" },
  { href: "/sim", label: "Sandbox" },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/cases" className="font-semibold tracking-tight">
            Countersign
          </Link>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 ${path.startsWith(n.href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            className="ml-auto text-sm text-muted hover:text-text"
            onClick={() => {
              setToken(null);
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
