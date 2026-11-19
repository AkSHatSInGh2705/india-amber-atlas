CREATE TABLE public.volunteer_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  kitchen text NOT NULL CHECK (char_length(btrim(kitchen)) BETWEEN 1 AND 80),
  area text NOT NULL CHECK (char_length(btrim(area)) BETWEEN 1 AND 60),
  pickup_window text NOT NULL CHECK (char_length(btrim(pickup_window)) BETWEEN 1 AND 40),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.volunteer_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_listings TO authenticated;
GRANT ALL ON public.volunteer_listings TO service_role;

ALTER TABLE public.volunteer_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings are public" ON public.volunteer_listings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Volunteers create their own listing" ON public.volunteer_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Volunteers edit their own listing" ON public.volunteer_listings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Volunteers delete their own listing" ON public.volunteer_listings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.volunteer_contacts (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL CHECK (phone ~ '^[0-9+ ]{10,14}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_contacts TO authenticated;
GRANT ALL ON public.volunteer_contacts TO service_role;

ALTER TABLE public.volunteer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own contact" ON public.volunteer_contacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner adds own contact" ON public.volunteer_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner edits own contact" ON public.volunteer_contacts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes own contact" ON public.volunteer_contacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER volunteer_listings_touch BEFORE UPDATE ON public.volunteer_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER volunteer_contacts_touch BEFORE UPDATE ON public.volunteer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();