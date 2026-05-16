export type Role = 'coach' | 'athlete'
export type LoadTag = 'light' | 'medium' | 'heavy'
export type RpeValue = 'failed' | 'hard' | 'medium' | 'easy'
export type BlockType = 'single' | 'superset'
export type PmSource = 'manual' | 'passthrough'

export interface Profile {
  id: string
  name: string
  role: Role
  coach_id: string | null
  created_at: string
}

export interface Exercise {
  id: string
  name: string
  video_url: string | null
  created_by: string | null
  created_at: string
}

export interface WorkoutDay {
  id: string
  athlete_id: string
  coach_id: string
  date: string
  name: string | null
  focus_tags: string[]
  created_at: string
}

export interface WorkoutBlock {
  id: string
  day_id: string
  type: BlockType
  position: number
  rest_between_ex_sec: number
  rest_between_rounds_sec: number
  rounds: number
  block_exercises?: BlockExercise[]
}

export interface BlockExercise {
  id: string
  block_id: string
  exercise_id: string
  position: number
  coach_comment: string | null
  video_url: string | null
  is_timed: boolean
  is_passthrough: boolean
  pt_instruction: string | null
  exercise?: Exercise
  sets?: WorkoutSet[]
}

export interface WorkoutSet {
  id: string
  be_id: string
  set_number: number
  reps: number | null
  duration_sec: number | null
  weight_kg: number | null
  weight_pct: number | null
  rest_sec: number
  rpe_enabled: boolean
  load_tag: LoadTag | null
  is_warmup: boolean
}

export interface PersonalMax {
  id: string
  athlete_id: string
  exercise_id: string
  weight_kg: number
  source: PmSource
  achieved_at: string
  exercise?: Exercise
}

export interface SetLog {
  id: string
  set_id: string | null
  be_id: string
  athlete_id: string
  actual_reps: number | null
  actual_weight: number | null
  rpe_value: RpeValue | null
  skipped: boolean
  is_passthrough: boolean
  logged_at: string
}

export interface WorkoutSession {
  id: string
  day_id: string
  athlete_id: string
  started_at: string
  finished_at: string | null
  total_sets: number
  total_volume_kg: number
}

export interface MotivationalMessage {
  id: number
  text: string
}

// Full workout day with all nested data
export interface FullWorkoutDay extends WorkoutDay {
  blocks: (WorkoutBlock & {
    block_exercises: (BlockExercise & {
      exercise: Exercise
      sets: WorkoutSet[]
    })[]
  })[]
}
