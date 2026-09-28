import { describe, it, expect } from "vitest";
import { supabaseUrl } from "@/lib/supabase";

describe("supabaseUrl", () => {
  it.each([
    ["https://abc.supabase.co", "https://abc.supabase.co"],
    ["https://abc.supabase.co/", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1/", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1", "https://abc.supabase.co"],
    [" https://abc.supabase.co/rest/v1/ ", "https://abc.supabase.co"],
  ])("%s → %s", (raw, want) => expect(supabaseUrl(raw)).toBe(want));
});
