-- Migration 0006: pin search_path on the new private helpers from 0005.
-- Matches the hardening pattern from 0002 for the prior set of helpers.

alter function private.normalize_slug(text)
  set search_path = public;

alter function private.generate_unique_business_slug(text, uuid)
  set search_path = public;

alter function private.tg_business_slug_default()
  set search_path = public;
