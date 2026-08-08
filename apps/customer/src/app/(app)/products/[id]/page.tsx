"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Redirect({ params }: { params: Promise<{ id: string }> }) {
  const r = useRouter();
  useEffect(() => {
    params.then((p) => r.replace(`/shop/p/${encodeURIComponent(p.id)}`));
  }, [params, r]);
  return null;
}
