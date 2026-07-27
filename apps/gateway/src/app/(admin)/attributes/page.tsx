import { redirect } from "next/navigation";

/** Attributes live inside Products now — keep old bookmark working. */
export default function AttributesRedirect() {
  redirect("/products");
}
