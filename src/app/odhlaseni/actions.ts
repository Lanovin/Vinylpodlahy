"use server";
import { redirect } from "next/navigation";
import { emailQueue, unsubscribes } from "@/lib/db/repos";
import { MARKETING_EMAIL_TYPES, verifyUnsubscribeToken } from "@/lib/unsubscribe";

/** Zruší naplánované marketingové e-maily pro adresu z podepsaného tokenu a zaznamená odhlášení. */
export async function unsubscribeAction(formData: FormData) {
  const email = verifyUnsubscribeToken(String(formData.get("token") ?? ""));
  if (!email) redirect("/odhlaseni?chyba=1");
  const cancelled = emailQueue.cancelPending(email, MARKETING_EMAIL_TYPES);
  unsubscribes.add({ email, createdAt: new Date().toISOString(), cancelled });
  redirect("/odhlaseni?hotovo=1");
}
