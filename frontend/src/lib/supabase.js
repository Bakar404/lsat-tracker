import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const TABLES = {
  rows: "lsat_rows",
  meta: "lsat_meta",
  profiles: "profiles",
};

export const DEFAULT_TRANSFORMER =
  import.meta.env.VITE_TRANSFORMER_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000/transform"
    : "https://lsat-tracker.onrender.com/transform");
