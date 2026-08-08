"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CategoryRedirect({ params }: { params: Promise<{ category: string }> }) {
  const router = useRouter();
  useEffect(() => {
    params.then((p) => {
      router.replace(`/shop?categoryId=${encodeURIComponent(p.category)}`);
    });
  }, [params, router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--ink-soft)]">
      Opening category…
    </div>
  );
}
