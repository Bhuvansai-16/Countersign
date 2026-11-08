"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { getToken, setToken, subscribeSellerSession } from "@/lib/api";
import { Brand } from "@/components/brand";

const NAV = [
  { href: "/cases", label: "Disputes" },
  { href: "/orders", label: "Orders" },
  { href: "/issues", label: "Resolutions" },
  { href: "/sim", label: "Test tools" },
];

function SellerWorkspace({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const token = useSyncExternalStore(subscribeSellerSession, getToken, () => null);

  useEffect(() => {
    if (!token && !getToken()) router.replace("/login");
  }, [router, token]);

  if (!token) return null;
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="product-header">
        <div className="product-header-inner">
          <Brand href="/cases" />
          <nav className="product-nav" aria-label="Merchant workspace">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path.startsWith(n.href) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
          <span className="environment-label">Sandbox payments</span>
          <button
            className="header-link"
            onClick={() => setToken(null)}
          >
            Sign out
          </button>
          </div>
        </div>
      </header>
      <main id="main-content" className="workspace-shell">{children}</main>
    </div>
  );
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}><SellerWorkspace>{children}</SellerWorkspace></Suspense>;
}
