const PREFIX = 'https://www.googleapis.com/auth/googlehealth'

export const SCOPE = {
  metricsRead: `${PREFIX}.health_metrics_and_measurements.readonly`,
  sleepRead: `${PREFIX}.sleep.readonly`,
  activityRead: `${PREFIX}.activity_and_fitness.readonly`,
  metricsWrite: `${PREFIX}.health_metrics_and_measurements.writeonly`
} as const

export const GOOGLE_HEALTH_SCOPES = [
  'openid',
  'email',
  SCOPE.metricsRead,
  SCOPE.sleepRead,
  SCOPE.activityRead,
  SCOPE.metricsWrite
]

export const DEFAULT_SYNC_CRON = 'TZ=America/Chicago 0 7,15 * * *'
