import Link from "next/link";

export function Brand({ href }: { href?: string }) {
  const wordmark = <><span className="brand-mark" aria-hidden="true">c.</span><span>Countersign</span></>;
  return href
    ? <Link href={href} className="brand" aria-label="Countersign home">{wordmark}</Link>
    : <span className="brand">{wordmark}</span>;
}
