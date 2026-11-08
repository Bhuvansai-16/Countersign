export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <main id="main-content">{children}</main>
  </>;
}
