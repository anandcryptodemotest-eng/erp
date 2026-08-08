"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Redirect({ params }: { params: Promise<{ groupCode: string }> }) {
  const r = useRouter();
  useEffect(() => {
    params.then((p) => r.replace(`/shop/g/${encodeURIComponent(p.groupCode)}`));
  }, [params, r]);
  return null;
}
