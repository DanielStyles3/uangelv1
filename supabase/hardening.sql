-- Extra lock, from the Supabase security advisor. NOT applied yet (optional: run it in the
-- Supabase SQL editor if you want it).
-- These functions already check is_admin() / auth.uid() inside; this also stops signed-out
-- visitors from calling them at all. Public ones (campaign_progress, referral_code_info,
-- is_admin) and trigger functions are left as they are.
do $$
declare f text;
begin
    foreach f in array array[
        'public.admin_affiliates()',
        'public.admin_commissions(uuid, boolean)',
        'public.admin_review_affiliate(uuid, boolean, text)',
        'public.admin_review_commission(uuid, jsonb, text)',
        'public.admin_set_withdrawal(uuid, text, text)',
        'public.affiliate_customer_orders(uuid)',
        'public.affiliate_referrals()',
        'public.affiliate_summary()',
        'public.apply_referral_code(text)',
        'public.become_affiliate()',
        'public.place_order(jsonb, text, text, text, text, text, text, text)',
        'public.request_withdrawal(numeric)',
        'public.set_affiliate_bank(text, text, text)'
    ] loop
        execute format('revoke execute on function %s from public, anon', f);
        execute format('grant execute on function %s to authenticated', f);
    end loop;
end $$;

alter function public.delivery_fee() set search_path = '';
