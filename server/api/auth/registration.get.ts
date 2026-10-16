import { registrationOpen } from '~~/server/utils/registration'

export default defineEventHandler(async () => ({ open: await registrationOpen() }))
