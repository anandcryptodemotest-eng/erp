"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Container, SectionHeader, Skeleton } from "@erp/ui";
import { AddressForm, type SavedAddress } from "@/components/AddressForm";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state?: string | null;
  pincode: string;
  isDefault: boolean;
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const custEnsure = await ensureCustomerProfile();
    if (custEnsure.customer) {
      setCustomerId(custEnsure.customer.id);
      setAddresses((custEnsure.customer.addresses as Address[] | undefined) ?? []);
      setError("");
    } else {
      setError(custEnsure.error || "Customer profile required");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaved(address: SavedAddress) {
    setMsg("Address saved");
    setShowForm(false);
    setAddresses((prev) => {
      const next = address.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false }))
        : prev;
      return [address, ...next.filter((a) => a.id !== address.id)];
    });
    await load();
  }

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Account
      </Link>
      <SectionHeader title="Addresses" className="mt-2" />

      {loading ? <Skeleton className="mt-4 h-24 w-full" /> : null}

      {error ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p>
      ) : null}

      {!loading && !error && (
        <>
          {addresses.length === 0 && !showForm ? (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">
              No saved addresses yet. Add one for checkout delivery.
            </p>
          ) : null}

          <ul className="mt-4 space-y-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-sm"
              >
                <p className="font-semibold text-[var(--ink)]">
                  {a.label}{" "}
                  {a.isDefault ? (
                    <span className="text-[var(--forest)]">(Default)</span>
                  ) : null}
                </p>
                <p className="text-[var(--ink-soft)]">
                  {a.line1}, {a.city}
                  {a.state ? `, ${a.state}` : ""} {a.pincode}
                </p>
              </li>
            ))}
          </ul>

          {!showForm ? (
            <Button
              className="mt-4 !rounded-md"
              variant="primary"
              onClick={() => {
                setMsg("");
                setShowForm(true);
              }}
              disabled={!customerId}
            >
              Add address
            </Button>
          ) : customerId ? (
            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4">
              <p className="mb-3 text-sm font-bold text-[var(--ink)]">New address</p>
              <AddressForm
                customerId={customerId}
                initial={{ isDefault: addresses.length === 0 }}
                onSaved={onSaved}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--danger)]">
              Customer profile missing — sign out and sign in again.
            </p>
          )}

          {msg ? <p className="mt-2 text-sm font-semibold text-[var(--forest)]">{msg}</p> : null}
        </>
      )}
    </Container>
  );
}
