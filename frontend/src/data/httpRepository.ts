import type {
  About,
  Account,
  Activity,
  ActivityInput,
  AuthStatus,
  Balance,
  ChangePasswordInput,
  Group,
  GroupInput,
  Fact,
  FactInput,
  FactLabel,
  Id,
  LedgerEntry,
  LedgerEntryInput,
  LoginInput,
  LoginResult,
  NewOpenPointInput,
  OpenPoint,
  OpenPointInput,
  Person,
  Membership,
  MembershipInput,
  PersonInput,
  SearchResult,
  SetupInput,
  Settings,
  SettingsPatch,
  TotpSetup,
} from '../domain/model'
import { type Repository, RepositoryError, type RepositoryErrorCode } from './repository'

const ERROR_CODES: readonly RepositoryErrorCode[] = [
  'not_found',
  'invalid',
  'unauthorized',
  'too_many_attempts',
  'internal',
]

/**
 * The repository against the backend's JSON API. Same origin: in development
 * Vite proxies `/api` to the backend, in production the backend serves the app.
 */
export class HttpRepository implements Repository {
  private readonly baseUrl: string

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  // ── Login ───────────────────────────────────────────────────────────────

  getAuthStatus() {
    return this.request<AuthStatus>('GET', '/auth/status')
  }

  login(input: LoginInput) {
    return this.request<LoginResult>('POST', '/auth/login', input)
  }

  loginWithCode(code: string) {
    return this.request<void>('POST', '/auth/login/totp', { code })
  }

  logout() {
    return this.request<void>('POST', '/auth/logout')
  }

  setup(input: SetupInput) {
    return this.request<void>('POST', '/setup', input)
  }

  getDemoLogin() {
    return this.orNull(this.request<LoginInput>('GET', '/demo'))
  }

  getAbout() {
    return this.request<About>('GET', '/about')
  }

  // ── Account ─────────────────────────────────────────────────────────────

  getAccount() {
    return this.request<Account>('GET', '/account')
  }

  changePassword(input: ChangePasswordInput) {
    return this.request<void>('PUT', '/account/password', input)
  }

  // ── Settings ────────────────────────────────────────────────────────────

  getSettings() {
    return this.request<Settings>('GET', '/account/settings')
  }

  updateSettings(patch: SettingsPatch) {
    return this.request<Settings>('PATCH', '/account/settings', patch)
  }

  // ── Two-factor login ────────────────────────────────────────────────────

  startTotp() {
    return this.request<TotpSetup>('POST', '/account/totp')
  }

  async confirmTotp(code: string) {
    const body = await this.request<{ recoveryCodes: string[] }>('POST', '/account/totp/confirm', { code })
    return body.recoveryCodes
  }

  disableTotp(password: string) {
    return this.request<void>('DELETE', '/account/totp', { password })
  }

  async renewRecoveryCodes(password: string) {
    const body = await this.request<{ recoveryCodes: string[] }>('POST', '/account/recovery-codes', { password })
    return body.recoveryCodes
  }

  // ── People ──────────────────────────────────────────────────────────────

  listPeople() {
    return this.request<Person[]>('GET', '/people')
  }

  getPerson(id: Id) {
    return this.orNull(this.request<Person>('GET', `/people/${id}`))
  }

  getSelf() {
    return this.request<Person>('GET', '/people/self')
  }

  createPerson(input: PersonInput) {
    return this.request<Person>('POST', '/people', input)
  }

  updatePerson(id: Id, input: PersonInput) {
    return this.request<Person>('PUT', `/people/${id}`, input)
  }

  deletePerson(id: Id) {
    return this.request<void>('DELETE', `/people/${id}`)
  }

  setPersonArchived(id: Id, archived: boolean) {
    return this.request<Person>('PUT', `/people/${id}/archived`, { archived })
  }

  setPersonPhoto(id: Id, image: Blob) {
    return this.request<Person>('PUT', `/people/${id}/photo`, image)
  }

  deletePersonPhoto(id: Id) {
    return this.request<void>('DELETE', `/people/${id}/photo`)
  }

  // ── Groups ────────────────────────────────────────────────────────────

  listGroups() {
    return this.request<Group[]>('GET', '/groups')
  }

  createGroup(input: GroupInput) {
    return this.request<Group>('POST', '/groups', input)
  }

  updateGroup(id: Id, input: GroupInput) {
    return this.request<Group>('PUT', `/groups/${id}`, input)
  }

  deleteGroup(id: Id) {
    return this.request<void>('DELETE', `/groups/${id}`)
  }

  setGroupArchived(id: Id, archived: boolean) {
    return this.request<Group>('PUT', `/groups/${id}/archived`, { archived })
  }

  // ── Person ↔ group ────────────────────────────────────────────────────

  listMemberships() {
    return this.request<Membership[]>('GET', '/memberships')
  }

  listMembershipsForPerson(personId: Id) {
    return this.request<Membership[]>('GET', `/people/${personId}/groups`)
  }

  addPersonToGroup({ personId, groupId }: MembershipInput) {
    return this.request<Membership>('PUT', `/people/${personId}/groups/${groupId}`)
  }

  removePersonFromGroup(personId: Id, groupId: Id) {
    return this.request<void>('DELETE', `/people/${personId}/groups/${groupId}`)
  }

  // ── Activities ──────────────────────────────────────────────────────────

  listActivities() {
    return this.request<Activity[]>('GET', '/activities')
  }

  listActivitiesForPerson(personId: Id) {
    return this.request<Activity[]>('GET', `/people/${personId}/activities`)
  }

  listActivitiesForGroup(groupId: Id) {
    return this.request<Activity[]>('GET', `/groups/${groupId}/activities`)
  }

  getActivity(id: Id) {
    return this.orNull(this.request<Activity>('GET', `/activities/${id}`))
  }

  createActivity(input: ActivityInput) {
    return this.request<Activity>('POST', '/activities', input)
  }

  updateActivity(id: Id, input: ActivityInput) {
    return this.request<Activity>('PUT', `/activities/${id}`, input)
  }

  deleteActivity(id: Id) {
    return this.request<void>('DELETE', `/activities/${id}`)
  }

  // ── Open points ─────────────────────────────────────────────────────────

  listOpenPoints(personId: Id) {
    return this.request<OpenPoint[]>('GET', `/people/${personId}/open-points`)
  }

  listOpenPointsForActivity(activityId: Id) {
    return this.request<OpenPoint[]>('GET', `/activities/${activityId}/open-points`)
  }

  createOpenPoint(personId: Id, input: NewOpenPointInput) {
    return this.request<OpenPoint>('POST', `/people/${personId}/open-points`, input)
  }

  updateOpenPoint(id: Id, input: OpenPointInput) {
    return this.request<OpenPoint>('PUT', `/open-points/${id}`, input)
  }

  setOpenPointDone(id: Id, done: boolean) {
    return this.request<OpenPoint>('PUT', `/open-points/${id}/done`, { done })
  }

  deleteOpenPoint(id: Id) {
    return this.request<void>('DELETE', `/open-points/${id}`)
  }

  // ── Money ───────────────────────────────────────────────────────────────

  listBalances() {
    return this.request<Balance[]>('GET', '/balances')
  }

  listLedgerEntries(personId: Id) {
    return this.request<LedgerEntry[]>('GET', `/people/${personId}/ledger-entries`)
  }

  listLedgerEntriesForActivity(activityId: Id) {
    return this.request<LedgerEntry[]>('GET', `/activities/${activityId}/ledger-entries`)
  }

  createLedgerEntry(personId: Id, input: LedgerEntryInput) {
    return this.request<LedgerEntry>('POST', `/people/${personId}/ledger-entries`, input)
  }

  updateLedgerEntry(id: Id, input: LedgerEntryInput) {
    return this.request<LedgerEntry>('PUT', `/ledger-entries/${id}`, input)
  }

  deleteLedgerEntry(id: Id) {
    return this.request<void>('DELETE', `/ledger-entries/${id}`)
  }

  // ── Knowledge ───────────────────────────────────────────────────────────

  listFacts(personId: Id) {
    return this.request<Fact[]>('GET', `/people/${personId}/facts`)
  }

  createFact(personId: Id, input: FactInput) {
    return this.request<Fact>('POST', `/people/${personId}/facts`, input)
  }

  updateFact(id: Id, input: FactInput) {
    return this.request<Fact>('PUT', `/facts/${id}`, input)
  }

  deleteFact(id: Id) {
    return this.request<void>('DELETE', `/facts/${id}`)
  }

  listFactLabels() {
    return this.request<FactLabel[]>('GET', '/facts/labels')
  }

  reorderFacts(personId: Id, orderedIds: Id[]) {
    return this.request<Fact[]>('PUT', `/people/${personId}/facts/order`, { factIds: orderedIds })
  }

  // ── Search ──────────────────────────────────────────────────────────────

  search(query: string, limit?: number) {
    const params = new URLSearchParams({ q: query })
    if (limit !== undefined) params.set('limit', String(limit))
    return this.request<SearchResult>('GET', `/search?${params}`)
  }

  // ── Transport ───────────────────────────────────────────────────────────

  /** A `Blob` body (photo) is sent as is, anything else as JSON. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.baseUrl + path, { method, ...encodeBody(body) })
    } catch {
      throw new RepositoryError('network', 'No connection to the server.')
    }

    if (!response.ok) throw await toError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  /** `get…` methods return `null` for a missing entity instead of throwing. */
  private async orNull<T>(request: Promise<T>): Promise<T | null> {
    try {
      return await request
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'not_found') return null
      throw error
    }
  }
}

function encodeBody(body: unknown): RequestInit {
  if (body === undefined) return {}
  if (body instanceof Blob) return { headers: { 'Content-Type': body.type }, body }
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** Reads the backend's `{ code, message }` body; anything else (e.g. a proxy error page) is `internal`. */
async function toError(response: Response): Promise<RepositoryError> {
  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown }
    const code = ERROR_CODES.find((c) => c === body.code)
    if (code && typeof body.message === 'string') return new RepositoryError(code, body.message)
  } catch {
    // not JSON
  }
  return new RepositoryError('internal', `Request failed (${response.status}).`)
}
