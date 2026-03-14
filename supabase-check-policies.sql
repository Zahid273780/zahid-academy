-- Run this in Supabase SQL Editor. Result is ONE cell - click it, Ctrl+A, Ctrl+C to copy.

SELECT string_agg(
  tablename || ' | ' || policyname || ' | ' || cmd || ' | ' || roles::text,
  E'\n'
  ORDER BY tablename, policyname
) AS "Copy this whole cell (Ctrl+A then Ctrl+C)"
FROM pg_policies
WHERE schemaname = 'public';
