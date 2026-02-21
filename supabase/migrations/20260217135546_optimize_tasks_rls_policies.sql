alter policy "Users can create their own tasks" on public.tasks
with check ((select auth.uid()) = user_id);

alter policy "Users can see their own tasks" on public.tasks
using ((select auth.uid()) = user_id);

alter policy "Users can update their own tasks" on public.tasks
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "Users can delete their own tasks" on public.tasks
using ((select auth.uid()) = user_id);;
