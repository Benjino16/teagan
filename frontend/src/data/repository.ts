import type {
  About,
  Account,
  Activity,
  ActivityInput,
  AuthStatus,
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
  TotpSetup,
} from '../domain/model'

/**
 * Access to all data, one method per backend route (`/api/…`). Components
 * never call it directly, only through the hooks in `queries.ts`.
 *
 * Updates replace all editable fields, like the `PUT` routes.
 * Errors are thrown as `RepositoryError`; a missing entity in `get…` is `null`.
 */
export interface Repository {
  // Login                                          /auth/status, /auth/login, /auth/logout
  /** Never throws `unauthorized`, unlike every route below. */
  getAuthStatus(): Promise<AuthStatus>
  /** Sets the session cookie – or, with two-factor login on, starts the code step. Wrong login: `invalid`. */
  login(input: LoginInput): Promise<LoginResult>
  /** The code step: TOTP or recovery code. Wrong code: `invalid`; step over: `not_found`.  /auth/login/totp */
  loginWithCode(code: string): Promise<void>
  logout(): Promise<void>
  /** Creates the first account and logs it in; `not_found` once any account exists.  /setup */
  setup(input: SetupInput): Promise<void>
  /** The demo account's login – `null` unless this is a demo build with the demo loaded.  /demo */
  getDemoLogin(): Promise<LoginInput | null>

  // Version and source code                        /about
  getAbout(): Promise<About>

  // Own account                                    /account
  getAccount(): Promise<Account>
  /** Ends all other logins; a wrong current password throws `invalid`.  /account/password */
  changePassword(input: ChangePasswordInput): Promise<void>

  // Two-factor login                               /account/totp, /account/recovery-codes
  /** A new secret; two-factor login is only on after `confirmTotp`. */
  startTotp(): Promise<TotpSetup>
  /** Turns it on; returns the recovery codes, shown once. Wrong code: `invalid`. */
  confirmTotp(code: string): Promise<string[]>
  disableTotp(password: string): Promise<void>
  /** The old codes stop working. */
  renewRecoveryCodes(password: string): Promise<string[]>

  // People                                         /people, /people/:id
  listPeople(): Promise<Person[]>
  getPerson(id: Id): Promise<Person | null>
  /** Your own person.                             /people/self */
  getSelf(): Promise<Person>
  createPerson(input: PersonInput): Promise<Person>
  updatePerson(id: Id, input: PersonInput): Promise<Person>
  deletePerson(id: Id): Promise<void>
  /** Idempotent, keeps the first `archivedAt`; not for yourself.  /people/:id/archived */
  setPersonArchived(id: Id, archived: boolean): Promise<Person>
  /** Any JPEG/PNG/WebP; the backend crops and re-encodes it.  /people/:id/photo */
  setPersonPhoto(id: Id, image: Blob): Promise<Person>
  /** Also fine without a photo. */
  deletePersonPhoto(id: Id): Promise<void>

  // Groups                                         /groups, /groups/:id
  listGroups(): Promise<Group[]>
  createGroup(input: GroupInput): Promise<Group>
  updateGroup(id: Id, input: GroupInput): Promise<Group>
  deleteGroup(id: Id): Promise<void>
  /** Idempotent; subgroups keep their own state.  /groups/:id/archived */
  setGroupArchived(id: Id, archived: boolean): Promise<Group>

  // Person ↔ group membership                      /memberships, /people/:id/groups/:groupId
  listMemberships(): Promise<Membership[]>
  listMembershipsForPerson(personId: Id): Promise<Membership[]>
  /** Also adds the main group of a subgroup. */
  addPersonToGroup(input: MembershipInput): Promise<Membership>
  /** Also removes the person from the group's subgroups. */
  removePersonFromGroup(personId: Id, groupId: Id): Promise<void>

  // Activities incl. participants and groups       /activities, /people/:id/activities
  listActivities(): Promise<Activity[]>
  listActivitiesForPerson(personId: Id): Promise<Activity[]>
  /** The group's and its subgroups' activities.   /groups/:id/activities */
  listActivitiesForGroup(groupId: Id): Promise<Activity[]>
  getActivity(id: Id): Promise<Activity | null>
  createActivity(input: ActivityInput): Promise<Activity>
  updateActivity(id: Id, input: ActivityInput): Promise<Activity>
  deleteActivity(id: Id): Promise<void>

  // Open points                                    /people/:id/open-points, /open-points/:id
  listOpenPoints(personId: Id): Promise<OpenPoint[]>
  /** Points that came out of an activity.         /activities/:id/open-points */
  listOpenPointsForActivity(activityId: Id): Promise<OpenPoint[]>
  createOpenPoint(personId: Id, input: NewOpenPointInput): Promise<OpenPoint>
  updateOpenPoint(id: Id, input: OpenPointInput): Promise<OpenPoint>
  setOpenPointDone(id: Id, done: boolean): Promise<OpenPoint>
  deleteOpenPoint(id: Id): Promise<void>

  // Money                                          /people/:id/ledger-entries, /ledger-entries/:id
  /** Newest first; their sum is the balance. */
  listLedgerEntries(personId: Id): Promise<LedgerEntry[]>
  /** Entries from an activity, for every person.  /activities/:id/ledger-entries */
  listLedgerEntriesForActivity(activityId: Id): Promise<LedgerEntry[]>
  /** Not with yourself: `invalid`. */
  createLedgerEntry(personId: Id, input: LedgerEntryInput): Promise<LedgerEntry>
  updateLedgerEntry(id: Id, input: LedgerEntryInput): Promise<LedgerEntry>
  deleteLedgerEntry(id: Id): Promise<void>

  // Knowledge                                      /people/:id/facts, /facts/:id
  listFacts(personId: Id): Promise<Fact[]>
  /** Goes to the bottom of the person's list. */
  createFact(personId: Id, input: FactInput): Promise<Fact>
  updateFact(id: Id, input: FactInput): Promise<Fact>
  deleteFact(id: Id): Promise<void>
  /** Labels used across all people, most used first.  /facts/labels */
  listFactLabels(): Promise<FactLabel[]>
  /** `orderedIds` must list each of the person's facts once.  /people/:id/facts/order */
  reorderFacts(personId: Id, orderedIds: Id[]): Promise<Fact[]>

  // Search                                         /search
  /** People, groups, events, knowledge and open points at once; `limit` hits per resource (1–100, default 10). */
  search(query: string, limit?: number): Promise<SearchResult>
}

/** The `code` of the backend's error body (`backend/src/http/error.rs`), plus `network`. */
export type RepositoryErrorCode =
  | 'not_found'
  | 'invalid'
  | 'unauthorized'
  | 'too_many_attempts'
  | 'internal'
  | 'network'

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
  }
}
