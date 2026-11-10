import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";

export default function Home() {
  return <div className="landing-page">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="product-header"><div className="product-header-inner"><Brand href="/" /><nav className="header-actions" aria-label="Main navigation"><Link href="/login" className="text-button">Merchant sign-in</Link><Link href="/shop" className="primary-button">Open app <span aria-hidden="true">↗</span></Link></nav></div></header>
    <main id="main-content">
      <section className="landing-hero">
        <div className="landing-copy"><p className="eyebrow">Shopping, with your say.</p><h1>A little help.<br /><em>A better find.</em></h1><p>Find what fits. Compare the details.<br />Approve every purchase.</p><Link href="/shop" className="primary-button">Open app <span aria-hidden="true">→</span></Link><span className="landing-no-login">No account. Just start exploring.</span></div>
        <div className="landing-art"><Image src="/images/shopping-meadow.png" alt="A painted meadow with a linen throw and a wrapped parcel under a tree" fill priority sizes="(max-width: 800px) 100vw, 55vw" /><div className="landing-request"><span>A good place to start</span><p>“A linen throw, under $90.”</p><span className="landing-request-arrow" aria-hidden="true">↗</span></div><span className="landing-art-caption">Your budget. Your final say.</span></div>
      </section>
      <section className="landing-steps" aria-label="How it works"><div><span>01</span><h2>Ask.</h2><p>Say what you need.</p></div><span aria-hidden="true">→</span><div><span>02</span><h2>Choose.</h2><p>Compare real options.</p></div><span aria-hidden="true">→</span><div><span>03</span><h2>Approve.</h2><p>Pay when you’re ready.</p></div></section>
    </main>
    <footer className="product-footer"><span>Countersign · Your intent, kept intact.</span><span className="environment-label">PayPal Sandbox</span></footer>
  </div>;
}
