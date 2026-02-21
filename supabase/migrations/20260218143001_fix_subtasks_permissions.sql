-- Grant base permissions to the roles Supabase uses
GRANT ALL ON TABLE "public"."subtasks" TO "anon";
GRANT ALL ON TABLE "public"."subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."subtasks" TO "service_role";

-- Ensure RLS is on
ALTER TABLE "public"."subtasks" ENABLE ROW LEVEL SECURITY;

-- Drop existing if any and re-create a clean policy
-- The current policy 'allow all' for 'public' role SHOULD have worked if grants were there, 
-- but let's make it explicit for authenticated role for better practice.
DROP POLICY IF EXISTS "allow all" ON "public"."subtasks";
DROP POLICY IF EXISTS "Everyone can select subtasks" ON "public"."subtasks";
DROP POLICY IF EXISTS "Authenticated users can do everything with subtasks" ON "public"."subtasks";

CREATE POLICY "Authenticated users can do everything with subtasks"
ON "public"."subtasks"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow anon for now if the app uses it, but usually authenticated is enough for this app
CREATE POLICY "Anon users can select subtasks"
ON "public"."subtasks"
FOR SELECT
TO anon
USING (true);
;
