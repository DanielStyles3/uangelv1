-- Catering / events on several separate days ("Specific dates": e.g. 5, 12 and 20 Dec).
-- event_date = the first of them (sorting, countdowns); end_date stays null;
-- event_dates = every chosen day, in order. Date ranges keep using event_date + end_date.
alter table public.service_requests add column if not exists event_dates date[];
alter table public.service_requests drop constraint if exists service_requests_event_dates_check;
alter table public.service_requests add constraint service_requests_event_dates_check
    check (event_dates is null or (cardinality(event_dates) between 1 and 366));
