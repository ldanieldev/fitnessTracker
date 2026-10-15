import { getTableColumns } from 'drizzle-orm'
import { users } from '../db/schema'

const { password: _password, sessionEpoch: _sessionEpoch, ...columns } = getTableColumns(users)

export const publicUserColumns = columns
