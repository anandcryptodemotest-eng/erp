import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Path alias → canonical query login. */
export default async function TenantLoginAliasPage({ params }: Props) {
  const { slug } = await params;
  const clean = slug.trim().toLowerCase();
  redirect(`/login?tenant=${encodeURIComponent(clean)}`);
}
