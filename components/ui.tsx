"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

// One grid theme follows the product's warm palette.
export const gridTheme = themeQuartz.withParams({
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--text)",
  headerBackgroundColor: "var(--surface-2)",
  headerTextColor: "var(--muted)",
  borderColor: "var(--border)",
  accentColor: "var(--accent)",
  rowHoverColor: "var(--accent-soft)",
  fontFamily: "var(--font-geist-sans)",
  fontSize: 13,
  headerFontWeight: 600,
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 16,
});

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const STRENGTH_TONE: Record<string, Tone> = { STRONG: "ok", MEDIUM: "warn", WEAK: "danger", NONE: "neutral" };
export const DECISION_TONE: Record<string, Tone> = { FIGHT: "accent", OFFER: "info", ACCEPT: "neutral", EXPIRED: "danger" };
export const STATE_TONE: Record<string, Tone> = {
  NEW: "neutral", ANALYZING: "info", AWAITING_APPROVAL: "warn", SUBMITTED: "accent", WON: "ok", LOST: "danger",
  ACCEPTED: "neutral", EXPIRED: "danger", NEEDS_ATTENTION: "danger", MANUAL: "neutral",
};
export const REASON_LABEL: Record<string, string> = {
  INR: "Not received", SNAD: "Not as described", UNAUTHORIZED: "Unauthorized", DUPLICATE: "Duplicate",
  CREDIT_NOT_PROCESSED: "Credit not processed", OTHER: "Other",
};

export function hoursLabel(hours: number | null): { text: string; tone: Tone } {
  if (hours === null) return { text: "-", tone: "neutral" };
  if (hours < 0) return { text: "Overdue", tone: "danger" };
  const text = hours < 48 ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m` : `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
  return { text, tone: hours < 24 ? "danger" : hours < 48 ? "warn" : "neutral" };
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  );
}
