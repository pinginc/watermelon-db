import fs from 'fs'
import { testSchema } from '../../__tests__/helpers'
import { schemaMigrations } from '../../../Schema/migrations'

import SQLiteAdapter from '../index'

const TMP_DIR = `${process.cwd()}/.tmp`

const makeDbPath = () => `${TMP_DIR}/onDatabaseCreated${Math.random()}.db`

const removeDb = (dbName) => {
  if (fs.existsSync(dbName)) {
    fs.unlinkSync(dbName)
  }
}

const openAdapter = async (options) => {
  const adapter = new SQLiteAdapter(options)
  await adapter.initializingPromise
  return adapter
}

const nextSchema = { ...testSchema, version: testSchema.version + 1 }

describe('SQLiteAdapter onDatabaseCreated', () => {
  let dbName

  beforeAll(() => {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR)
    }
  })

  beforeEach(() => {
    dbName = makeDbPath()
  })

  afterEach(() => {
    removeDb(dbName)
  })

  it('fires once when the database is set up from scratch', async () => {
    const onDatabaseCreated = jest.fn()

    await openAdapter({ dbName, schema: testSchema, onDatabaseCreated })

    expect(onDatabaseCreated).toHaveBeenCalledTimes(1)
  })

  it('does not fire when an existing database is opened', async () => {
    await openAdapter({ dbName, schema: testSchema })
    const onDatabaseCreated = jest.fn()

    await openAdapter({ dbName, schema: testSchema, onDatabaseCreated })

    expect(onDatabaseCreated).not.toHaveBeenCalled()
  })

  it('does not fire when an existing database is migrated', async () => {
    await openAdapter({ dbName, schema: testSchema })
    const onDatabaseCreated = jest.fn()

    await openAdapter({
      dbName,
      schema: nextSchema,
      migrations: schemaMigrations({ migrations: [{ toVersion: nextSchema.version, steps: [] }] }),
      onDatabaseCreated,
    })

    expect(onDatabaseCreated).not.toHaveBeenCalled()
  })

  it('fires when an existing database is reset because no migration is available', async () => {
    await openAdapter({ dbName, schema: testSchema })
    const onDatabaseCreated = jest.fn()

    await openAdapter({ dbName, schema: nextSchema, onDatabaseCreated })

    expect(onDatabaseCreated).toHaveBeenCalledTimes(1)
  })

  it('still initializes when the callback throws', async () => {
    const onDatabaseCreated = jest.fn(() => {
      throw new Error('callback failed')
    })

    await expect(
      openAdapter({ dbName, schema: testSchema, onDatabaseCreated }),
    ).resolves.toBeInstanceOf(SQLiteAdapter)
    expect(onDatabaseCreated).toHaveBeenCalledTimes(1)
  })
})
