import type { Metadata } from "next";

import { PayStatus } from "./pay-status";

export const dynamic = "force-dynamic";

type Params = { reference: string };

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false },
};

export default async function PayPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { reference } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
      <PayStatus reference={reference} />
    </main>
  );
}
