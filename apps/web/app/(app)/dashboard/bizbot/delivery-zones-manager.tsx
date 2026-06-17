"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { useRouter } from "next/navigation";
import { Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { formatNairaFromKobo } from "@/lib/format";
import {
  archiveDeliveryZone,
  createDeliveryZone,
  updateDeliveryZone,
} from "./actions";

export type DeliveryZone = {
  id: string;
  label: string;
  feeKobo: number;
  note: string;
};

type Editor = {
  id: string | "new";
  label: string;
  fee: string;
  note: string;
};

const SUGGESTED_AREAS = [
  "Lekki / VI",
  "Mainland",
  "Ikeja",
  "Abuja",
  "Nationwide",
  "Pickup (free)",
] as const;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

export function DeliveryZonesManager({ zones }: { zones: DeliveryZone[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openAdd = (presetLabel = "") => {
    setError(null);
    setEditor({ id: "new", label: presetLabel, fee: "", note: "" });
  };
  const openEdit = (zone: DeliveryZone) => {
    setError(null);
    setEditor({
      id: zone.id,
      label: zone.label,
      fee: String(zone.feeKobo / 100),
      note: zone.note,
    });
  };
  const closeEditor = () => {
    setError(null);
    setEditor(null);
  };
  const patchEditor = (patch: { label?: string; fee?: string; note?: string }) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = () => {
    if (!editor) return;
    const label = editor.label.trim();
    if (!label) {
      setError("Add an area name.");
      return;
    }
    if (editor.fee.trim() === "") {
      setError("Add a delivery fee (enter 0 for free).");
      return;
    }
    const target = editor;
    startTransition(async () => {
      const res =
        target.id === "new"
          ? await createDeliveryZone({ label, fee: target.fee, note: target.note })
          : await updateDeliveryZone(target.id, { label, fee: target.fee, note: target.note });
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
      const res = await archiveDeliveryZone(id);
      if (res.ok) {
        setEditor((prev) => (prev && prev.id === id ? null : prev));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const editorOpenForNew = editor?.id === "new";
  const hasZones = zones.length > 0;

  return (
    <div className="space-y-3">
      {error ? (
        <Notice variant="error">{error}</Notice>
      ) : null}

      {hasZones ? (
        <ul className="space-y-2">
          {zones.map((zone) => {
            const isEditing = editor?.id === zone.id;
            return (
              <li
                key={zone.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
              >
                {isEditing && editor ? (
                  <ZoneEditor
                    label={editor.label}
                    fee={editor.fee}
                    note={editor.note}
                    onChange={patchEditor}
                    onSave={save}
                    onCancel={closeEditor}
                    isPending={isPending}
                  />
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{zone.label}</p>
                      {zone.note ? (
                        <p className="mt-0.5 text-xs text-text-muted">{zone.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatNairaFromKobo(zone.feeKobo)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(zone)}
                          disabled={isPending}
                          aria-label={"Edit " + zone.label}
                          className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => archive(zone.id)}
                          disabled={isPending}
                          aria-label={"Remove " + zone.label}
                          className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {editorOpenForNew && editor ? (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <ZoneEditor
            label={editor.label}
            fee={editor.fee}
            note={editor.note}
            onChange={patchEditor}
            onSave={save}
            onCancel={closeEditor}
            isPending={isPending}
          />
        </div>
      ) : hasZones ? (
        <button
          type="button"
          onClick={() => openAdd()}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.25} />
          Add delivery area
        </button>
      ) : (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-card sm:p-10">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <MapPin size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No delivery areas yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add where you deliver and the fee. Start with an area:
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTED_AREAS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => openAdd(a)}
                className="rounded-full bg-surface-muted px-3.5 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-black/[0.06] transition-colors hover:text-foreground hover:ring-black/[0.12]"
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneEditor(props: {
  label: string;
  fee: string;
  note: string;
  onChange: (patch: { label?: string; fee?: string; note?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { label, fee, note, onChange, onSave, onCancel, isPending } = props;
  const canSave = label.trim() !== "" && fee.trim() !== "";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="z-label">Delivery area</Label>
        <input
          id="z-label"
          type="text"
          value={label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Lekki / VI"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="z-fee">Delivery fee (Naira)</Label>
        <input
          id="z-fee"
          type="text"
          inputMode="decimal"
          value={fee}
          onChange={(e) => onChange({ fee: e.target.value })}
          placeholder="3000"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-text-muted">Enter 0 for free delivery.</p>
      </div>
      <div>
        <Label htmlFor="z-note">Note (optional)</Label>
        <input
          id="z-note"
          type="text"
          value={note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="e.g. 2-3 days, or order before 2pm"
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
