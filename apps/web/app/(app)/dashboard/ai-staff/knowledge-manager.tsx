"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  archiveKnowledgeItem,
  createKnowledgeItem,
  updateKnowledgeItem,
} from "./actions";

export type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
};

type Editor = { id: string | "new"; title: string; content: string };

const SUGGESTED_TITLES = [
  "Refund policy",
  "Returns & exchanges",
  "Warranty",
  "Business hours",
  "Payment methods",
  "Delivery areas",
  "Things to never promise",
  "How to greet customers",
] as const;

const inputClass =
  "mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30";

export function KnowledgeManager({ items }: { items: KnowledgeItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openAdd = (presetTitle = "") => {
    setError(null);
    setEditor({ id: "new", title: presetTitle, content: "" });
  };
  const openEdit = (item: KnowledgeItem) => {
    setError(null);
    setEditor({ id: item.id, title: item.title, content: item.content });
  };
  const closeEditor = () => {
    setError(null);
    setEditor(null);
  };
  const patchEditor = (patch: { title?: string; content?: string }) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = () => {
    if (!editor) return;
    const title = editor.title.trim();
    const content = editor.content.trim();
    if (!title) {
      setError("Add a title.");
      return;
    }
    if (!content) {
      setError("Add the answer your AI should give.");
      return;
    }
    const target = editor;
    startTransition(async () => {
      const res =
        target.id === "new"
          ? await createKnowledgeItem({ title, content })
          : await updateKnowledgeItem(target.id, { title, content });
      if (res.ok) {
        setEditor(null);
        setError(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const archive = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveKnowledgeItem(id);
      if (res.ok) {
        setEditor((prev) => (prev && prev.id === id ? null : prev));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const editorOpenForNew = editor?.id === "new";
  const hasItems = items.length > 0;

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {hasItems ? (
        <ul className="space-y-2">
          {items.map((item) => {
            const isEditing = editor?.id === item.id;
            return (
              <li
                key={item.id}
                className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-5"
              >
                {isEditing && editor ? (
                  <KnowledgeEditor
                    title={editor.title}
                    content={editor.content}
                    onChange={patchEditor}
                    onSave={save}
                    onCancel={closeEditor}
                    isPending={isPending}
                  />
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                        {item.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        disabled={isPending}
                        aria-label={"Edit " + item.title}
                        className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => archive(item.id)}
                        disabled={isPending}
                        aria-label={"Remove " + item.title}
                        className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {editorOpenForNew && editor ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-5">
          <KnowledgeEditor
            title={editor.title}
            content={editor.content}
            onChange={patchEditor}
            onSave={save}
            onCancel={closeEditor}
            isPending={isPending}
          />
        </div>
      ) : hasItems ? (
        <button
          type="button"
          onClick={() => openAdd()}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.25} />
          Add knowledge
        </button>
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-black/[0.04] sm:p-10">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <BookOpen size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">Nothing taught yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add the answers your AI should give. Start with a common question:
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTED_TITLES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => openAdd(t)}
                className="rounded-full bg-surface-muted px-3.5 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-black/[0.06] transition-colors hover:text-foreground hover:ring-black/[0.12]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeEditor(props: {
  title: string;
  content: string;
  onChange: (patch: { title?: string; content?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { title, content, onChange, onSave, onCancel, isPending } = props;
  const canSave = title.trim() !== "" && content.trim() !== "";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="k-title">Question / topic</Label>
        <input
          id="k-title"
          type="text"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Refund policy"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="k-content">Answer your AI should give</Label>
        <textarea
          id="k-content"
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={4}
          placeholder="Write it the way you'd want a customer to hear it."
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          <Check size={16} strokeWidth={2.25} />
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
        >
          <X size={16} strokeWidth={2.25} />
          Cancel
        </button>
      </div>
    </div>
  );
}
