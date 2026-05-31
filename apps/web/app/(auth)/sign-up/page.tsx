"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "../actions";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return (
    <div className="bg-surface rounded-card border border-border shadow-[0_24px_60px_rgba(0,0,0,0.06)] p-7 sm:p-8">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-foreground leading-tight">
          Create your business account
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          Free to start. No credit card required.
        </p>
      </div>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="full_name">Your name</Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            placeholder="Adaeze Kalu"
            required
            autoComplete="name"
            className="mt-1.5"
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@yourbusiness.com"
            required
            autoComplete="email"
            className="mt-1.5"
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1.5"
            disabled={isPending}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-warning/10 border border-warning/20 px-3.5 py-2.5 text-[13px] text-warning">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-brand-soft border border-brand-primary/20 px-3.5 py-2.5 text-[13px] text-brand-dark leading-relaxed">
            {success}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full group"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create account
              <ArrowRight
                className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-foreground hover:text-brand-primary transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
