import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ReplyComposer } from "@/components/reply-composer";
import { ThreadMessages } from "./thread-messages";
import {
  getConversationHeader,
  getMessages,
  markConversationRead,
} from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationThreadPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const header = await getConversationHeader(supabase, id, business.id);
  if (!header) notFound();

  // Fire-and-forget unread reset on view. Idempotent; safe to await.
  await markConversationRead(supabase, id, business.id);

  const messages = await getMessages(supabase, id);

  const displayName = header.customer_name
    ?? header.contact_phone_e164
    ?? "Customer";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-4">
        <Link
          href="/dashboard/conversations"
          className="grid size-10 place-items-center rounded-xl ring-1 ring-black/[0.06] hover:bg-surface-muted"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {displayName}
          </h1>
          {header.contact_phone_e164 && header.customer_name ? (
            <p className="truncate text-sm text-text-secondary">{header.contact_phone_e164}</p>
          ) : null}
        </div>
      </header>

      <ThreadMessages conversationId={id} initialMessages={messages} />

      <ReplyComposer conversationId={id} />
    </div>
  );
}
