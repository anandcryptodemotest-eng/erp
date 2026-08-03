import { redirect } from "next/navigation";

/** Compat alias — prefer /sales-desk. */
export default function OmsRedirect() {
  redirect("/sales-desk");
}
