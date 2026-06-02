"use client";

import { useEffect, useState, useCallback } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatNairaFromKobo } from "@/lib/format";

type StatusData = {
  payment_status: string;
  amount_kobo: number;
  currency: string;
  order_status: string;
  receipt_code: string | null;
  business: { name: string; logo_path: string | null };
};

type Phase = "loading" | "pending" | "paid" | "notfound" | "error";

export function PayStatus({ reference }: { reference: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");

  const poll = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: result, error } = await supabase.rpc("get_payment_status", {
        reference_input: reference,
      });
      if (error) {
        setPhase("error");
        return false;
      }
      if (!result) {
        setPhase("notfound");
        return true; // stop polling; nothing to wait for
      }
      const d = result as StatusData;
      setData(d);
      // Source of truth is the ORDER being paid, not this one payment row:
      // an order can be paid by a different payment attempt/reference.
      if (d.order_status === "paid") {
        setPhase("paid");
        return true; // done
      }
      setPhase("pending");
      return false; // keep polling
    } catch {
      setPhase("error");
      return false;
    }
  }, [reference]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const done = await poll();
      if (!active || done) return;
      timer = setTimeout(tick, 3000); // poll every 3s while pending
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  if (phase === "loading") {
    return (
      <div className="text-center">
        <Spinner />
        <p className="mt-4 text-sm text-text-secondary">Checking payment status...</p>
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <Card>
        <p className="text-base font-medium text-foreground">Payment not found</p>
        <p className="mt-1.5 text-sm text-text-secondary">
          This payment link is invalid or has expired.
        </p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card>
        <p className="text-base font-medium text-foreground">Something went wrong</p>
        <p className="mt-1.5 text-sm text-text-secondary">
          We could not check this payment. Please refresh the page.
        </p>
      </Card>
    );
  }

  if (phase === "paid" && data) {
    return (
      <Card>
        <div className="grid size-14 place-items-center rounded-full bg-brand-primary/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-7 text-brand-primary"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">Payment confirmed</p>
        <p className="mt-1 text-sm text-text-secondary">
          {formatNairaFromKobo(data.amount_kobo)} paid to {data.business.name}.
        </p>
        {data.receipt_code ? (
          <a
            href={"/r/" + data.receipt_code}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
          >
            View receipt
          </a>
        ) : null}
      </Card>
    );
  }

  // pending
  return (
    <Card>
      <Spinner />
      <p className="mt-4 text-lg font-semibold text-foreground">Confirming payment</p>
      <p className="mt-1 text-sm text-text-secondary">
        {data ? formatNairaFromKobo(data.amount_kobo) + " to " + data.business.name + ". " : ""}
        This usually takes a few seconds. You can keep this page open.
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center rounded-3xl bg-white px-8 py-10 text-center ring-1 ring-black/[0.04]">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-8 animate-spin text-brand-primary" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
