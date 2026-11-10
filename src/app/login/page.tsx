import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import { DATA_PROTECTION_STATEMENT } from "@/lib/legal-text";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");
  return (
    <main className="min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="bg-cane-800 text-white px-6 py-10 lg:px-14 lg:py-16 flex flex-col">
        <p className="text-cane-200 text-sm">Angata Sugar Mills Limited</p>
        <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] max-w-[14ch]">
          Cane Permit Tracker
        </h1>
        <p className="mt-5 text-cane-100 text-lg max-w-prose leading-relaxed">
          One record for every contracted field, from the scout's first visit to the harvest permit and transport zone.
        </p>
        <ol className="mt-10 grid gap-3 text-[15px] text-cane-100 max-w-md">
          {[
            "Scout captures the farmer, field boundary, documents and signature",
            "Call centre confirms every detail with the farmer",
            "IT checks the data and posts it to Synergy Bravo",
            "Permit officer opens the permit and issues CCS clips",
            "Legal confirms the physical documents are in hand",
            "GIS reviews the polygon and confirms the zone",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cane-600 text-[13px] font-bold">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <details className="mt-auto pt-10 text-[13px] text-cane-200 max-w-prose">
          <summary className="cursor-pointer hover:text-white">Data protection statement</summary>
          <p className="mt-2 leading-relaxed">{DATA_PROTECTION_STATEMENT}</p>
        </details>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <LoginForm />
      </section>
    </main>
  );
}
