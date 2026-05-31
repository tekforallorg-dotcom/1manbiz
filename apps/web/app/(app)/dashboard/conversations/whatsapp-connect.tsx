"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { connectWhatsAppAction, type ConnectState } from "./actions";

const initialState: ConnectState = { status: "idle", error: null, fieldErrors: {} };

export function WhatsAppConnect(props: {
  existingError: string | null;
  existingStatus: string | null;
}) {
  const [state, formAction, isPending] = useActionState(connectWhatsAppAction, initialState);

  return (
    <div className="space-y-6">
      {props.existingStatus === "failed" && props.existingError ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Previous connection failed: {props.existingError}
        </div>
      ) : null}

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Connect WhatsApp Business</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Paste your phone-number ID and access token from Meta App Dashboard &middot; WhatsApp &middot; API Setup.
        </p>

        <form action={formAction} className="mt-6 space-y-5">
          <div>
            <Label htmlFor="phone_number_id">Phone number ID</Label>
            <Input
              id="phone_number_id"
              name="phone_number_id"
              required
              maxLength={64}
              placeholder="e.g. 123456789012345"
              className="mt-1.5 font-mono tabular-nums"
              aria-invalid={Boolean(state.fieldErrors?.phone_number_id)}
            />
            {state.fieldErrors?.phone_number_id ? (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.phone_number_id}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="access_token">Access token</Label>
            <Input
              id="access_token"
              name="access_token"
              type="password"
              required
              maxLength={2048}
              placeholder="EAAxxxxx..."
              className="mt-1.5 font-mono"
              aria-invalid={Boolean(state.fieldErrors?.access_token)}
            />
            {state.fieldErrors?.access_token ? (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.access_token}</p>
            ) : (
              <p className="mt-1.5 text-xs text-text-muted">
                Temporary tokens last 24h. For long-term use, generate a system user token in Business Settings.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="token_type">
              Token type
            </Label>
            <select
              id="token_type"
              name="token_type"
              defaultValue="temporary"
              className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <option value="temporary">Temporary (24h test token)</option>
              <option value="permanent">Permanent (system user token)</option>
            </select>
          </div>

          {state.status === "error" && state.error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {state.error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Verifying with Meta..." : "Connect WhatsApp"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl bg-surface-muted/40 p-6 text-sm text-text-secondary ring-1 ring-black/[0.04] sm:p-8">
        <h3 className="text-base font-medium text-foreground">Before you connect</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>In your Meta App Dashboard, go to WhatsApp &middot; Configuration &middot; Webhooks.</li>
          <li>Set Callback URL to <code className="rounded bg-white px-1.5 py-0.5 text-xs">https://1manbiz.vercel.app/api/webhooks/whatsapp</code></li>
          <li>Set Verify Token to the value of WHATSAPP_WEBHOOK_VERIFY_TOKEN in your environment.</li>
          <li>Click Verify and Save, then subscribe to the <strong>messages</strong> field.</li>
          <li>Come back here and paste your phone-number ID and token from WhatsApp &middot; API Setup.</li>
        </ol>
      </section>
    </div>
  );
}
