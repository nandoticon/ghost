-- Add user_id to tasks
ALTER TABLE public.tasks 
ADD COLUMN user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid();

-- Add user_id to projects
ALTER TABLE public.projects 
ADD COLUMN user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid();

-- Add user_id to comments
ALTER TABLE public.comments 
ADD COLUMN user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid();

-- Update RLS policies to enforce ownership
DROP POLICY IF EXISTS "Allow all for personal use" ON public.tasks;
CREATE POLICY "Tasks are owned by user" ON public.tasks
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all for personal use" ON public.projects;
CREATE POLICY "Projects are owned by user" ON public.projects
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all for personal use" ON public.comments;
CREATE POLICY "Comments are owned by user" ON public.comments
    FOR ALL USING (auth.uid() = user_id);
;
