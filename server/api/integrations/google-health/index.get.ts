import { connectionStatus } from '~~/server/utils/googleHealth/connection'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => connectionStatus(await requireUserId(event)))
