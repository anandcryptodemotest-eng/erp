"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

const DEMO_TENANT = "wimflo";
const MAIL = "mailto:hello@sankalpplatforms.com?subject=WimFlo%20for%20our%20business";

function orgHref(path: string, slug: string) {
  const clean = slug.trim().toLowerCase();
  const q = clean ? `?tenant=${encodeURIComponent(clean)}` : "";
  return `${path}${q}`;
}

export function MarketingLanding() {
  const glow = useRef<HTMLDivElement>(null);
  const [signIn, setSignIn] = useState(false);
  const [slug, setSlug] = useState(DEMO_TENANT);

  useEffect(() => {
    const el = glow.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    if (!signIn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSignIn(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signIn]);

  function goPortal(e: FormEvent) {
    e.preventDefault();
    window.location.href = orgHref("/login", slug);
  }

  return (
    <div className="wf-root">
      <div className="wf-atmosphere" aria-hidden />
      <div className="wf-vignette" aria-hidden />
      <div className="wf-grain" aria-hidden />
      <div className="wf-glow" ref={glow} aria-hidden />

      <header className="wf-chrome">
        <a className="wf-logo" href="#top">
          <span className="wf-logo-mark">W</span>
          wimFlo <em>SAAS</em>
        </a>
        <nav className="wf-chrome-right">
          <span className="wf-sys-tag">a Sankalp Platforms product</span>
          <a className="wf-pill" href="#plans">
            Plans
          </a>
          <button type="button" className="wf-pill" onClick={() => setSignIn(true)}>
            Sign in
          </button>
        </nav>
      </header>

      <main className="wf-stage" id="top">
        <section className="wf-hero">
          <div className="wf-copy">
            <p className="wf-kicker">
              <span className="wf-tick">SYS.00</span> Multi-tenant ERP for growing businesses
            </p>
            <h1 className="wf-mega">
              WIMFLO
              <br />
              <span>one flow.</span>
            </h1>
            <p className="wf-lede">
              One SaaS operating system for sales, stock, purchasing, delivery and your
              customer portal. Onboard any SME. They work the business. Sankalp Platforms
              runs the platform.
            </p>
            <div className="wf-actions">
              <button type="button" className="wf-cta" onClick={() => setSignIn(true)}>
                Sign in &amp; explore
              </button>
              <Link className="wf-cta wf-cta-ghost" href={`/home?tenant=${DEMO_TENANT}`}>
                Open a live workspace
              </Link>
            </div>
            <p className="wf-scroll-hint">
              <span />
              SCROLL THE SYSTEM
            </p>
          </div>
          <div className="wf-badges" aria-hidden>
            <span className="wf-badge wf-b1">MULTI-TENANT</span>
            <span className="wf-badge wf-b2">SALES · STOCK</span>
            <span className="wf-badge wf-b3">CUSTOMER PORTAL</span>
            <span className="wf-badge wf-b4">WHATSAPP</span>
            <span className="wf-badge wf-b5">SME READY</span>
          </div>
        </section>

        <section className="wf-section" id="why">
          <div className="wf-section-inner">
            <p className="wf-kicker">
              <span className="wf-tick">SYS.01</span> Why SMEs subscribe
            </p>
            <h2 className="wf-big">
              Stay on the business.
              <br />
              <i>We keep the flow.</i>
            </h2>
            <p className="wf-lede">
              No licenses to buy, no servers to babysit. Each company is an isolated
              tenant — their catalog, orders, staff and customers — on one continuously
              evolved platform.
            </p>
            <div className="wf-grid-3">
              <article className="wf-card">
                <div className="wf-card-meta">
                  <span className="wf-card-code">01</span>
                  <span className="wf-card-tag">SUBSCRIBE</span>
                </div>
                <h3>Monthly, not forever</h3>
                <p>Start with the depth you need. Step up a plan when operations grow — without changing how people work.</p>
              </article>
              <article className="wf-card">
                <div className="wf-card-meta">
                  <span className="wf-card-code">02</span>
                  <span className="wf-card-tag">ISOLATED</span>
                </div>
                <h3>Every SME, their world</h3>
                <p>Branded portal, own warehouse picture, own staff roles. Neighbours on the platform never see each other.</p>
              </article>
              <article className="wf-card">
                <div className="wf-card-meta">
                  <span className="wf-card-code">03</span>
                  <span className="wf-card-tag">YOURS</span>
                </div>
                <h3>Your data stays yours</h3>
                <p>Product updates land for everyone. Your orders, stock and customers remain the company’s — not the vendor’s.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="wf-section" id="apps">
          <div className="wf-section-inner">
            <p className="wf-kicker">
              <span className="wf-tick">SYS.02</span> Three doors, one platform
            </p>
            <h2 className="wf-big">
              Sign in to the
              <br />
              <i>application you run.</i>
            </h2>
            <p className="wf-lede">
              Buyers, operators and platform staff each get a purpose-built surface —
              not a single dull back-office.
            </p>
            <div className="wf-grid-3">
              <Link className="wf-card" href={orgHref("/login", slug)}>
                <div className="wf-card-meta">
                  <span className="wf-card-code">APP.01</span>
                  <span className="wf-card-tag">CUSTOMERS</span>
                </div>
                <h3>Portal</h3>
                <p>Dealers and buyers browse, configure, checkout and track — on a branded storefront for that business.</p>
                <ul className="wf-specs">
                  <li>Catalog</li>
                  <li>Cart</li>
                  <li>Orders</li>
                  <li>WhatsApp</li>
                </ul>
              </Link>
              <a className="wf-card" href={orgHref("/admin/login", slug)}>
                <div className="wf-card-meta">
                  <span className="wf-card-code">APP.02</span>
                  <span className="wf-card-tag">OPERATORS</span>
                </div>
                <h3>Operations</h3>
                <p>Tenant staff run order desk, inventory, purchasing and fulfillment for their company.</p>
                <ul className="wf-specs">
                  <li>Order desk</li>
                  <li>Stock</li>
                  <li>Purchasing</li>
                  <li>Delivery</li>
                </ul>
              </a>
              <a className="wf-card" href="/platform/login">
                <div className="wf-card-meta">
                  <span className="wf-card-code">APP.03</span>
                  <span className="wf-card-tag">SANKALP</span>
                </div>
                <h3>Platform</h3>
                <p>Onboard tenants, billing, process studio and the control plane for every SME on WimFlo.</p>
                <ul className="wf-specs">
                  <li>Tenants</li>
                  <li>Billing</li>
                  <li>Studio</li>
                  <li>Audit</li>
                </ul>
              </a>
            </div>
          </div>
        </section>

        <section className="wf-section" id="flow">
          <div className="wf-section-inner">
            <p className="wf-kicker">
              <span className="wf-tick">SYS.03</span> In the flow
            </p>
            <h2 className="wf-big">
              One operating picture,
              <br />
              <i>not a stack of tools.</i>
            </h2>
            <div className="wf-grid-3">
              {[
                ["Sales & CRM", "Quotations, orders, discounts, returns, customers and follow-ups."],
                ["Inventory", "Movements, reservations, alerts. Pro adds valuation and warehouse transfers."],
                ["Purchasing", "Vendors, POs and goods receipt, tied to live stock."],
                ["Customer portal", "Branded cart, checkout, tracking, reorder and invoices."],
                ["Delivery", "Despatch in the same flow as sales and inventory."],
                ["Mobile & WhatsApp", "PWA, Android, OTP, notifications and two-way support."],
              ].map(([title, body]) => (
                <article className="wf-card" key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wf-section" id="plans">
          <div className="wf-section-inner">
            <p className="wf-kicker">
              <span className="wf-tick">SYS.04</span> Plans
            </p>
            <h2 className="wf-big">
              Choose the depth
              <br />
              <i>your operations need.</i>
            </h2>
            <p className="wf-lede">Move from Business to Business Pro when you scale. Same product family — more rooms in the building.</p>
            <div className="wf-grid-2">
              <article className="wf-card wf-plan">
                <p className="wf-plan-name">Business</p>
                <p className="wf-price">
                  ₹4,999 <small>/ month</small>
                </p>
                <p className="wf-audience">Growing SMEs — core operations, customers, inventory and sales.</p>
                <div className="wf-stats">
                  <div>
                    <strong>10</strong>
                    <span>users</span>
                  </div>
                  <div>
                    <strong>1</strong>
                    <span>warehouse</span>
                  </div>
                  <div>
                    <strong>25 GB</strong>
                    <span>storage</span>
                  </div>
                </div>
                <ul>
                  <li>Sales, inventory, purchasing and delivery</li>
                  <li>Branded customer portal, PWA and Android</li>
                  <li>WhatsApp OTP, notifications and 2-way support</li>
                  <li>Standard reports, basic workflows and approvals</li>
                </ul>
              </article>
              <article className="wf-card wf-plan is-pro">
                <p className="wf-plan-name">Business Pro</p>
                <p className="wf-price">
                  ₹14,999 <small>/ month</small>
                </p>
                <p className="wf-audience">Ready to scale — automation, AI and integrations.</p>
                <div className="wf-stats">
                  <div>
                    <strong>25</strong>
                    <span>users</span>
                  </div>
                  <div>
                    <strong>Multi</strong>
                    <span>warehouse</span>
                  </div>
                  <div>
                    <strong>100 GB</strong>
                    <span>storage</span>
                  </div>
                </div>
                <ul>
                  <li>Everything in Business, including the portal</li>
                  <li>Multi-warehouse transfers and advanced operations</li>
                  <li>Workflow automation, dashboards and AI analytics</li>
                  <li>REST API, webhooks, advanced access and audit logs</li>
                </ul>
              </article>
            </div>
            <div className="wf-notes">
              <p>Prices exclude applicable taxes. WhatsApp, SMS and other provider fees are billed at actuals.</p>
              <p>Finance &amp; Accounting, HR and iOS setup are not in Business / Business Pro — custom work can be scoped separately.</p>
            </div>
          </div>
        </section>

        <section className="wf-section wf-close">
          <p className="wf-kicker" style={{ justifyContent: "center" }}>
            <span className="wf-tick">SYS.05</span> Daybreak
          </p>
          <h2 className="wf-mega" style={{ fontSize: "clamp(38px, 7.5vw, 96px)" }}>
            Put your SME
            <br />
            <span>on the flow.</span>
          </h2>
          <p className="wf-lede" style={{ marginLeft: "auto", marginRight: "auto" }}>
            Tell us the business. We’ll open a tenant.
          </p>
          <div className="wf-actions" style={{ justifyContent: "center" }}>
            <a className="wf-cta" href={MAIL}>
              hello@sankalpplatforms.com
            </a>
            <button type="button" className="wf-cta wf-cta-ghost" onClick={() => setSignIn(true)}>
              Sign in
            </button>
          </div>
          <footer className="wf-foot">
            <span>WIMFLO · A SANKALP PLATFORMS PRODUCT</span>
            <span>WWW.WIMFLO.COM</span>
            <span>© 2026 — MULTI-TENANT SAAS · SALES · INVENTORY · PORTAL · DELIVERY</span>
          </footer>
        </section>
      </main>

      {signIn ? (
        <div
          className="wf-modal"
          role="dialog"
          aria-label="Sign in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSignIn(false);
          }}
        >
          <div className="wf-modal-card">
            <div className="wf-modal-head">
              <div>
                <p className="wf-kicker" style={{ marginBottom: 0 }}>
                  <span className="wf-tick">ENTER</span> Choose an application
                </p>
                <h2>Sign in to WimFlo</h2>
              </div>
              <button type="button" className="wf-x" aria-label="Close" onClick={() => setSignIn(false)}>
                ×
              </button>
            </div>
            <div className="wf-doors">
              <a className="wf-door" href={orgHref("/login", slug)}>
                <strong>Customer portal</strong>
                <span>Buyers and dealers for a tenant workspace.</span>
                <em>Enter portal →</em>
              </a>
              <a className="wf-door" href={orgHref("/admin/login", slug)}>
                <strong>Operations</strong>
                <span>Staff console — orders, catalog, warehouse.</span>
                <em>Enter admin →</em>
              </a>
              <a className="wf-door" href="/platform/login">
                <strong>Platform</strong>
                <span>Sankalp operators — tenants and billing.</span>
                <em>Enter platform →</em>
              </a>
            </div>
            <form className="wf-slug" onSubmit={goPortal}>
              <label htmlFor="tenant-slug">Organisation slug</label>
              <input
                id="tenant-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="acme"
                autoComplete="organization"
              />
              <p>
                Used for portal and operations. Try <strong>{DEMO_TENANT}</strong> to explore the live demo tenant, or{" "}
                <Link href={`/home?tenant=${DEMO_TENANT}`} style={{ color: "#6ff2ff" }}>
                  open the workspace without signing in
                </Link>
                .
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
