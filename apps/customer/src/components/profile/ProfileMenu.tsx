"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, isAuthenticated } from "@/lib/api-client";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";

const NAME_CACHE_KEY = "customer_display_name";

function firstNameOf(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part || "You";
}

function readCachedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NAME_CACHE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeCachedName(name: string) {
  try {
    localStorage.setItem(NAME_CACHE_KEY, name);
  } catch {
    /* ignore */
  }
}

const MENU_LINKS = [
  { href: "/profile", label: "Profile overview" },
  { href: "/orders", label: "My orders" },
  { href: "/inbox", label: "Messages" },
  { href: "/profile/addresses", label: "Addresses" },
  { href: "/profile/notifications", label: "Notifications" },
  { href: "/profile/details", label: "Personal details" },
  { href: "/profile/preferences", label: "Preferences" },
  { href: "/profile/support", label: "Support" },
] as const;

export function useCustomerFirstName() {
  const [firstName, setFirstName] = useState("");
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(async () => {
    const ok = isAuthenticated();
    setAuthed(ok);
    if (!ok) {
      setFirstName("");
      return;
    }
    const cached = readCachedName();
    if (cached) setFirstName(firstNameOf(cached));
    const r = await ensureCustomerProfile();
    if (r.customer?.name) {
      writeCachedName(r.customer.name);
      setFirstName(firstNameOf(r.customer.name));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { firstName, authed, refresh };
}

/** Avatar + first-name trigger; opens a menu of profile options. */
export function ProfileMenu({
  variant = "header",
  className,
}: {
  variant?: "header" | "nav";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { firstName, authed, refresh } = useCustomerFirstName();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = authed ? firstName || "You" : "Sign in";
  const initial = (label[0] || "?").toUpperCase();
  const active = pathname.startsWith("/profile") || pathname.startsWith("/account");

  function toggle() {
    if (!authed) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname || "/profile")}`);
      return;
    }
    setOpen((v) => !v);
    void refresh();
  }

  function signOut() {
    clearAuth();
    try {
      localStorage.removeItem(NAME_CACHE_KEY);
    } catch {
      /* ignore */
    }
    setOpen(false);
    router.replace("/login");
  }

  const trigger =
    variant === "nav" ? (
      <button
        type="button"
        onClick={toggle}
        className={`relative flex min-h-[var(--touch-min)] w-full flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
          active || open ? "text-[var(--forest)]" : "text-[var(--ink-soft)]"
        } ${className ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--forest)] text-[11px] font-bold text-white">
          {authed ? initial : "?"}
        </span>
        <span className="max-w-[4.5rem] truncate">{label}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-[#f5f5f5] ${
          active || open ? "text-[var(--forest)]" : "text-[var(--ink-soft)]"
        } ${className ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--forest)] text-xs font-bold text-white">
          {authed ? initial : "?"}
        </span>
        <span className="max-w-[7rem] truncate">{label}</span>
      </button>
    );

  return (
    <div ref={rootRef} className={`relative ${variant === "nav" ? "flex flex-1" : ""}`}>
      {trigger}

      {open ? (
        <>
          {variant === "nav" ? (
            <button
              type="button"
              className="fixed inset-0 z-[60] bg-black/30"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
          ) : null}
          <div
            id={menuId}
            role="menu"
            className={
              variant === "nav"
                ? "fixed inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#e8e8e8] bg-white pb-[env(safe-area-inset-bottom)] shadow-lg"
                : "absolute right-0 top-full z-[70] mt-1 w-64 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white shadow-lg"
            }
          >
            <div className="border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-bold text-[var(--ink)]">{firstName || "Customer"}</p>
              <p className="text-xs text-[var(--ink-soft)]">Account & settings</p>
            </div>
            <ul className="py-1">
              {MENU_LINKS.map((item) => (
                <li key={item.href} role="none">
                  <Link
                    role="menuitem"
                    href={item.href}
                    className="block px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[#fafafa]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#f0f0f0] p-2">
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold text-[var(--danger)] hover:bg-red-50"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
