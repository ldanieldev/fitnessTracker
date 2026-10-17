import { isCalendarDate } from '~~/shared/utils/calendarDate'

export const isDiaryDateRoute = (route: { params: Record<string, unknown> }) =>
  isCalendarDate(String(route.params.date))
