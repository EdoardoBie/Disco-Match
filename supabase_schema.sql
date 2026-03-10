-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
-- Stores user profile information. Linked to auth.users.
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  nickname text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_seen timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- QUESTIONS TABLE
-- Questions created by admins for the night.
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  text text not null,
  type text not null check (type in ('text', 'choice', 'photo')),
  options jsonb, -- For 'choice' type, e.g., ["Dance", "Talk"]
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on questions
alter table public.questions enable row level security;

-- Policies for questions
create policy "Questions are viewable by everyone"
  on public.questions for select
  using ( true );

create policy "Admins can insert/update/delete questions"
  on public.questions for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ANSWERS TABLE
-- Stores user answers to questions.
create table public.answers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  answer_data jsonb not null, -- Stores the actual answer (text, option index, or photo URL)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, question_id)
);

-- Enable RLS on answers
alter table public.answers enable row level security;

-- Policies for answers
create policy "Users can see their own answers"
  on public.answers for select
  using ( auth.uid() = user_id );

-- Ideally, for matching, we might need to allow users to see others' answers OR
-- (better) use a secure function to calculate matches without exposing raw answers.
-- For this MVP, let's allow authenticated users to read answers to calculate matches client-side
-- OR we keep it private and use a database function.
-- Let's stick to: Users can insert their own answers.
create policy "Users can insert their own answers"
  on public.answers for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own answers"
  on public.answers for update
  using ( auth.uid() = user_id );

-- MATCHES TABLE (Optional, if we want to persist matches)
-- For now, we might calculate them on the fly, but storing them allows for "history".
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  user_a uuid references public.profiles(id) on delete cascade not null,
  user_b uuid references public.profiles(id) on delete cascade not null,
  score float,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.matches enable row level security;

create policy "Users can see their own matches"
  on public.matches for select
  using ( auth.uid() = user_a or auth.uid() = user_b );

-- STORAGE BUCKETS
-- We need a bucket for 'avatars' and 'photos' (for drink photos etc)
-- Note: You need to create these buckets in the Supabase Dashboard manually or via API,
-- SQL support for storage creation is limited/specific.
-- However, we can set policies if the buckets exist.

-- TRIGGER for new users
-- Automatically create a profile entry when a new user signs up via Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (new.id, 'Ghost User', '');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
