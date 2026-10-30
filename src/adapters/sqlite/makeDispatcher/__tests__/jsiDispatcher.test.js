import { makeDispatcher } from '../index.native'

jest.mock('react-native', () => ({ NativeModules: {}, Platform: { OS: 'ios' } }), { virtual: true })

const DB_NAME = 'test'
const PASSWORD = 'secret'

const makeJsiDispatcher = (options) =>
  makeDispatcher('jsi', 'tag', DB_NAME, { usesExclusiveLocking: false, ...options })

describe('SqliteJsiDispatcher', () => {
  afterEach(() => {
    delete global.nativeWatermelonCreateAdapter
  })

  it('passes the wipe flag to a native adapter that accepts it', () => {
    const createAdapter = jest.fn(
      (_dbName, _password, _wipeOnPassphraseMismatch, _usesExclusiveLocking) => ({}),
    )
    global.nativeWatermelonCreateAdapter = createAdapter

    makeJsiDispatcher({ password: PASSWORD, wipeOnPassphraseMismatch: true })

    expect(createAdapter).toHaveBeenCalledWith(DB_NAME, PASSWORD, true, false)
  })

  it('defaults the wipe flag to false', () => {
    const createAdapter = jest.fn(
      (_dbName, _password, _wipeOnPassphraseMismatch, _usesExclusiveLocking) => ({}),
    )
    global.nativeWatermelonCreateAdapter = createAdapter

    makeJsiDispatcher({ password: PASSWORD })

    expect(createAdapter).toHaveBeenCalledWith(DB_NAME, PASSWORD, false, false)
  })

  it('drops the wipe flag for a native adapter that predates it', () => {
    const createAdapter = jest.fn((_dbName, _password, _usesExclusiveLocking) => ({}))
    global.nativeWatermelonCreateAdapter = createAdapter

    makeJsiDispatcher({
      password: PASSWORD,
      wipeOnPassphraseMismatch: true,
      usesExclusiveLocking: true,
    })

    expect(createAdapter).toHaveBeenCalledWith(DB_NAME, PASSWORD, true)
  })
})
