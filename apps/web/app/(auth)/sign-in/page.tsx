"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "../actions";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signInAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-surface rounded-card border border-border shadow-[0_24px_60px_rgba(0,0,0,0.06)] p-7 sm:p-8">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-foreground leading-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          Sign in to your 1Man.Biz account.
        </p>
      </div>

      <form action={handleSubmit} className="mt-6 space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {/* Future: forgot password link
            <Link href="/forgot-password" className="text-[12.5px] font-medium text-text-secondary hover:text-foreground transition-colors">
              Forgot?
            </Link>
            */}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5"
            disabled={isPending}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-warning/10 border border-warning/20 px-3.5 py-2.5 text-[13px] text-warning">
            {error}
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
              Sign in
              <ArrowRight
                className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-text-secondary">
        New to 1Man.Biz?{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-foreground hover:text-brand-primary transition-colors"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
