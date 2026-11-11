-- Referrals are permanent (owner's decision, 11 Nov 2026): a customer who signs up with an
-- affiliate's code stays linked to that affiliate for good, and every order they pay for
-- earns commission. The commission engine still checks expires_at, so it is pushed to the
-- far future instead of dropping the column (old app versions still read it).
alter table public.referrals alter column expires_at set default timestamptz '9999-12-31 00:00:00+00';
update public.referrals set expires_at = timestamptz '9999-12-31 00:00:00+00' where expires_at < timestamptz '9999-12-31 00:00:00+00';
