-- Enable DELETE for admins on orders table
create policy "Enable delete for admins"
on "public"."orders"
as permissive
for delete
to public
using (
  (auth.uid() in (
    select profiles.id
    from profiles
    where (profiles.role = 'admin'::text)
  ))
);
