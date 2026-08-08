"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy /account → /profile */
export default function AccountRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return null;
}
