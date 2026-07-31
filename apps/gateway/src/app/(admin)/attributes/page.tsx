import { redirect } from "next/navigation";

/** Attributes / custom fields live under Products for now. */
export default function AttributesRedirect() {
  redirect("/products?tab=fields");
}
