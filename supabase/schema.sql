-- ============================================================
-- TIGERS POWER — Schema
-- Run this in Supabase SQL Editor (once)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('coach','athlete')),
  coach_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now()
);

-- ============================================================
-- EXERCISES (global library)
-- ============================================================
create table public.exercises (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  video_url   text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- ============================================================
-- WORKOUT DAYS (one day = one training session)
-- ============================================================
create table public.workout_days (
  id          uuid primary key default uuid_generate_v4(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  coach_id    uuid not null references public.profiles(id),
  date        date not null,
  name        text,
  focus_tags  text[] default '{}',
  created_at  timestamptz default now(),
  unique (athlete_id, date)
);

-- ============================================================
-- WORKOUT BLOCKS (single exercise or superset)
-- ============================================================
create table public.workout_blocks (
  id                      uuid primary key default uuid_generate_v4(),
  day_id                  uuid not null references public.workout_days(id) on delete cascade,
  type                    text not null check (type in ('single','superset')),
  position                int not null default 0,
  rest_between_ex_sec     int default 0,
  rest_between_rounds_sec int default 60,
  rounds                  int default 1,
  created_at              timestamptz default now()
);

-- ============================================================
-- BLOCK EXERCISES (exercises inside a block)
-- ============================================================
create table public.block_exercises (
  id              uuid primary key default uuid_generate_v4(),
  block_id        uuid not null references public.workout_blocks(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id),
  position        int not null default 0,
  coach_comment   text,
  video_url       text,
  is_timed        boolean default false,
  is_passthrough  boolean default false,
  pt_instruction  text,
  created_at      timestamptz default now()
);

-- ============================================================
-- SETS (planned sets for each block_exercise)
-- ============================================================
create table public.sets (
  id            uuid primary key default uuid_generate_v4(),
  be_id         uuid not null references public.block_exercises(id) on delete cascade,
  set_number    int not null,
  reps          int,
  duration_sec  int,
  weight_kg     numeric(6,2),
  weight_pct    int,               -- % of personal max
  rest_sec      int default 60,
  rpe_enabled   boolean default false,
  load_tag      text check (load_tag in ('light','medium','heavy')),
  is_warmup     boolean default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- PERSONAL MAXES
-- ============================================================
create table public.personal_maxes (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid not null references public.profiles(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id),
  weight_kg     numeric(6,2) not null,
  source        text default 'manual' check (source in ('manual','passthrough')),
  achieved_at   date default current_date,
  created_at    timestamptz default now(),
  unique (athlete_id, exercise_id)
);

-- ============================================================
-- SET LOGS (actual performance logged by athlete)
-- ============================================================
create table public.set_logs (
  id             uuid primary key default uuid_generate_v4(),
  set_id         uuid references public.sets(id) on delete set null,
  be_id          uuid not null references public.block_exercises(id) on delete cascade,
  athlete_id     uuid not null references public.profiles(id) on delete cascade,
  actual_reps    int,
  actual_weight  numeric(6,2),
  rpe_value      text check (rpe_value in ('failed','hard','medium','easy')),
  skipped        boolean default false,
  is_passthrough boolean default false,
  logged_at      timestamptz default now()
);

-- ============================================================
-- WORKOUT SESSIONS (track start/finish of a workout)
-- ============================================================
create table public.workout_sessions (
  id              uuid primary key default uuid_generate_v4(),
  day_id          uuid not null references public.workout_days(id) on delete cascade,
  athlete_id      uuid not null references public.profiles(id) on delete cascade,
  started_at      timestamptz default now(),
  finished_at     timestamptz,
  total_sets      int default 0,
  total_volume_kg numeric(10,2) default 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.exercises        enable row level security;
alter table public.workout_days     enable row level security;
alter table public.workout_blocks   enable row level security;
alter table public.block_exercises  enable row level security;
alter table public.sets             enable row level security;
alter table public.personal_maxes   enable row level security;
alter table public.set_logs         enable row level security;
alter table public.workout_sessions enable row level security;

-- Profiles: everyone sees their own + coach sees athletes
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

create policy "coach_sees_athletes" on public.profiles
  for select using (coach_id = auth.uid());

-- Exercises: everyone can read, coaches can write
create policy "exercises_read" on public.exercises
  for select using (true);

create policy "exercises_write" on public.exercises
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

-- Workout days: coach sees all their athletes, athlete sees own
create policy "workout_days_coach" on public.workout_days
  for all using (coach_id = auth.uid());

create policy "workout_days_athlete" on public.workout_days
  for select using (athlete_id = auth.uid());

-- Blocks / exercises / sets: accessible if can access the day
create policy "blocks_access" on public.workout_blocks
  for all using (
    exists (
      select 1 from public.workout_days d
      where d.id = day_id
        and (d.coach_id = auth.uid() or d.athlete_id = auth.uid())
    )
  );

create policy "be_access" on public.block_exercises
  for all using (
    exists (
      select 1 from public.workout_blocks b
      join public.workout_days d on d.id = b.day_id
      where b.id = block_id
        and (d.coach_id = auth.uid() or d.athlete_id = auth.uid())
    )
  );

create policy "sets_access" on public.sets
  for all using (
    exists (
      select 1 from public.block_exercises be
      join public.workout_blocks b on b.id = be.block_id
      join public.workout_days d on d.id = b.day_id
      where be.id = be_id
        and (d.coach_id = auth.uid() or d.athlete_id = auth.uid())
    )
  );

-- Personal maxes: coach and athlete both access
create policy "pm_access" on public.personal_maxes
  for all using (
    athlete_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = athlete_id and p.coach_id = auth.uid()
    )
  );

-- Set logs: athlete writes own, coach reads their athletes
create policy "logs_athlete" on public.set_logs
  for all using (athlete_id = auth.uid());

create policy "logs_coach_read" on public.set_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = athlete_id and p.coach_id = auth.uid()
    )
  );

-- Sessions: same as logs
create policy "sessions_athlete" on public.workout_sessions
  for all using (athlete_id = auth.uid());

create policy "sessions_coach_read" on public.workout_sessions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = athlete_id and p.coach_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTION: auto-update personal max after passthrough log
-- ============================================================
create or replace function update_personal_max()
returns trigger language plpgsql security definer as $$
declare
  v_exercise_id uuid;
  v_current_max numeric;
begin
  -- get exercise id from block_exercise
  select be.exercise_id into v_exercise_id
  from public.block_exercises be where be.id = new.be_id;

  -- get current max
  select weight_kg into v_current_max
  from public.personal_maxes
  where athlete_id = new.athlete_id and exercise_id = v_exercise_id;

  -- update if new weight is higher and reps = 1 (true 1RM)
  if new.actual_reps = 1 and new.actual_weight is not null then
    if v_current_max is null or new.actual_weight > v_current_max then
      insert into public.personal_maxes (athlete_id, exercise_id, weight_kg, source, achieved_at)
      values (new.athlete_id, v_exercise_id, new.actual_weight, 'passthrough', current_date)
      on conflict (athlete_id, exercise_id)
      do update set weight_kg = new.actual_weight, source = 'passthrough', achieved_at = current_date;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_update_personal_max
  after insert on public.set_logs
  for each row when (new.is_passthrough = true)
  execute function update_personal_max();

-- ============================================================
-- SEED: motivational messages (used on workout complete screen)
-- ============================================================
create table public.motivational_messages (
  id      serial primary key,
  text    text not null
);

insert into public.motivational_messages (text) values
  ('Красава, поебошил на славу!'),
  ('Машина! Железо сегодня плакало.'),
  ('Зверь! Завтра будет болеть, но ты это заслужил.'),
  ('Мощно выдал — так держать!'),
  ('Всё, что не убивает — делает тебя больше.'),
  ('Топ! Именно так и строится сила.'),
  ('Сегодня ты превзошёл себя. Реально.'),
  ('Железо не врёт. И ты не подвёл.'),
  ('Тяжело было? Отлично. Значит росло.'),
  ('Не каждый сюда приходит. Ты пришёл и сделал.'),
  ('Прогресс — это и есть ты сегодня.'),
  ('Ещё одна тренировка в копилку силы.'),
  ('Гордись. Ты сделал то, что большинство откладывает.'),
  ('Тело запомнит эту работу. Оно всегда помнит.'),
  ('Отдыхай. Ты это заработал.'),
  ('Каждый подход — кирпич. Ты строишь.'),
  ('Сильнее, чем был вчера. Без вопросов.'),
  ('Легко не было? Правильно. Так и должно быть.'),
  ('Ты не пропустил. Это главное.'),
  ('Следующая тренировка уже ждёт. Но сначала — гордись.');
