export interface EmporiumTask {
  task_id: number
  template_id: number
  /** Shards times ten. */
  shards: number
  task_type: string
  title: string
  description: string
  image: string
  button: string
  status: string
  /** Price in the task's currency; TLM in 1/10000 TLM. */
  currency_start: number
  currency_end: number
  user: string
  timestamp_created: string
  timestamp_closed: string
  duration: number
}

/** emporium.mc `config`. */

export interface EmporiumConfig {
  simultaneous_tasks: number
  progressupdate_seconds: number
  tick_percent_decrease: number
}
