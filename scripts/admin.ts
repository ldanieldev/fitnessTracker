import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../server/db/schema'
import { findUserIdByEmail, overwritePassword, transferAdmin } from '../server/utils/admin/accounts'

const USAGE = 'Usage: admin set-admin <email> | admin set-password <email>'

// nuxt-auth-utils builds this same Scrypt with no options because nuxt.config.ts sets no `hash`; keep them in step.
export function hashAppPassword(password: string) {
  return new Hash(new Scrypt({})).make(password)
}

export function passwordProblem(first: string, second: string): string | null {
  if (first.length < 8) return 'Password must be at least 8 characters'
  if (first !== second) return 'Passwords do not match'
  return null
}

class PromptAborted extends Error {
  constructor(readonly exitCode: number) {
    super('Prompt aborted')
  }
}

function promptHidden(question: string): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk)
      callback()
    }
  })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  return new Promise((resolve, reject) => {
    let answered = false
    let done = false
    const abort = (exitCode: number) => {
      if (done) return
      done = true
      process.stdout.write('\n')
      reject(new PromptAborted(exitCode))
    }
    rl.on('SIGINT', () => {
      abort(130)
      rl.close()
    })
    rl.on('close', () => {
      if (!answered) abort(1)
    })
    rl.question(question, (answer) => {
      answered = true
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

export async function runAdmin(argv: string[]): Promise<number> {
  const [command, email] = argv
  if (!email || (command !== 'set-admin' && command !== 'set-password')) {
    console.error(USAGE)
    return 2
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set')
    return 1
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c TimeZone=UTC' })
  const client = drizzle({ client: pool, schema })
  try {
    const userId = await findUserIdByEmail(client, email)
    if (userId === null) {
      console.error(`No account with email ${email}`)
      return 1
    }
    if (command === 'set-admin') {
      const { changed } = await transferAdmin(client, userId, { bumpEpochs: true })
      console.log(changed ? `${email} is now the admin` : `${email} is already the admin`)
      return 0
    }
    if (!process.stdin.isTTY) {
      console.error('set-password needs a terminal: use docker exec -it')
      return 1
    }
    let first: string
    let problem: string | null
    try {
      first = await promptHidden('New password: ')
      problem = passwordProblem(first, await promptHidden('Repeat password: '))
    } catch (error) {
      if (error instanceof PromptAborted) return error.exitCode
      throw error
    }
    if (problem) {
      console.error(problem)
      return 1
    }
    await overwritePassword(client, userId, await hashAppPassword(first))
    console.log(`Password set for ${email}; signed out everywhere`)
    return 0
  } finally {
    await pool.end()
  }
}

if (import.meta.main) process.exit(await runAdmin(process.argv.slice(2)))
