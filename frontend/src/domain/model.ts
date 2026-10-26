/**
 * Domain data model, as the backend sends it (DB columns in camelCase).
 * Nullable columns are `null`, not `undefined`.
 */

export type Id = number

/**
 * Truncated ISO date: `YYYY` | `YYYY-MM` | `YYYY-MM-DD` | `YYYY-MM-DDTHH:MM`. Length = precision.
 * The time only exists on the start of point events.
 */
export type PartialDate = string

/** Full date `YYYY-MM-DD`. */
export type IsoDate = string

/** Birthday: `YYYY-MM-DD` | `--MM-DD` (year unknown) | `YYYY` (only age known). */
export type Birthday = string

/** Technical timestamp, ISO 8601 in UTC: `2026-10-15T12:00:00Z`. */
export type Timestamp = string

export type Impact = 1 | 2 | 3 | 4 | 5

/** Name and explanation of an impact level. */
export interface ImpactLevel {
  label: string
  description: string
}

/** How an activity felt: 1 = very bad, 3 = neutral, 5 = very good. */
export type Mood = 1 | 2 | 3 | 4 | 5

/** Name and explanation of a mood. */
export interface MoodLevel {
  label: string
  description: string
}

export interface Timestamps {
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Person extends Timestamps {
  id: Id
  name: string
  nickname: string | null
  birthday: Birthday | null
  /** Free text about the birthday, e.g. gift ideas. Only with a birthday. */
  birthdayNote: string | null
  /** Reconnect rhythm in days, `null` = no rhythm. */
  reconnectDays: number | null
  /** How close the person is to you: 1 = side note, 5 = inner circle. */
  impact: Impact
  /** A relationship you deliberately want to improve. Never on yourself. */
  focus: boolean
  /**
   * Stays in lists and pickers; reconnect and focus pause, birthdays and the
   * day of death show as remembrance. Never yourself.
   */
  deceased: boolean
  /** Only with `deceased`, and only as a full date – `null` = date unknown. */
  diedOn: IsoDate | null
  /**
   * `null` = active. Archived people drop out of lists, pickers and reminders,
   * but keep everything else – focus and rhythm just pause. Never yourself.
   */
  archivedAt: Timestamp | null
  /** Profile photo, `null` = initials. */
  photo: PhotoUrls | null
  /** Exactly one person is yourself. */
  isSelf: boolean
}

/** The two sizes the backend stores; the URLs change with the photo, so they can be cached forever. */
export interface PhotoUrls {
  /** 128 px – lists, stacks */
  thumb: string
  /** 256 px – person header */
  large: string
}

/** What the person form does with the photo: leave it, upload a new one, or remove it. */
export type PhotoChange = 'keep' | 'remove' | Blob

export interface Group extends Timestamps {
  id: Id
  name: string
  parentId: Id | null
  /**
   * `null` = active. Only the group's own state: a subgroup also counts as archived
   * while its main group is, see `isGroupArchived`.
   */
  archivedAt: Timestamp | null
}

/** Pure link without further data – nothing to update, so only `createdAt`. */
export interface Membership {
  personId: Id
  groupId: Id
  createdAt: Timestamp
}

export interface ActivityParticipant {
  personId: Id
  /** Impact for this person only, `null` = the activity's global value. */
  impact: Impact | null
  /** Mood for this person only, `null` = the activity's mood (which may be none). */
  mood: Mood | null
  /** Note for this person only, `null` = none. */
  note: string | null
}

/** A group the activity belongs to. */
export interface ActivityGroup {
  groupId: Id
  /** Impact for this group only, `null` = the activity's global value. */
  impact: Impact | null
  /** Mood for this group only, `null` = the activity's mood (which may be none). */
  mood: Mood | null
  /** Note for this group only, `null` = none. */
  note: string | null
}

export interface Activity extends Timestamps {
  id: Id
  name: string
  /** Key into the icon catalog, purely visual. */
  icon: string
  startDate: PartialDate
  /** `null` = point event, set = closed range. */
  endDate: PartialDate | null
  description: string | null
  /** Free text, e.g. “Café Fritz”, `null` = none. */
  location: string | null
  impact: Impact
  /** Optional, `null` = no mood. People and groups can have their own even then. */
  mood: Mood | null
  /** Reminder on the start day, only with a full start date. */
  reminder: boolean
  /** At least one person or group. */
  participants: ActivityParticipant[]
  groups: ActivityGroup[]
}

export interface OpenPoint extends Timestamps {
  id: Id
  personId: Id
  text: string
  /** Source, optional. */
  activityId: Id | null
  doneAt: Timestamp | null
}

export interface Fact extends Timestamps {
  id: Id
  personId: Id
  label: string
  value: string
  /** Smaller = further up. */
  sort: number
}

/** One resource's hits in a search: the best ones, and how many there are in all. */
export interface SearchHits<T> {
  items: T[]
  total: number
}

/**
 * Hits across all resources, best first. Archived people and groups, done points
 * and entries of archived people come last.
 */
export interface SearchResult {
  people: SearchHits<Person>
  groups: SearchHits<Group>
  activities: SearchHits<Activity>
  facts: SearchHits<Fact>
  openPoints: SearchHits<OpenPoint>
}

/** A label used across all people, with its number of uses. */
export interface FactLabel {
  label: string
  count: number
}

/** Whether this browser is logged in, and whether there is an account at all yet. */
export interface AuthStatus {
  loggedIn: boolean
  setupRequired: boolean
}

export interface LoginInput {
  username: string
  password: string
}

/** With two-factor login on, the password only opens the code step. */
export interface LoginResult {
  totpRequired: boolean
}

/** The logged-in account. */
export interface Account {
  username: string
  totpEnabled: boolean
  recoveryCodesLeft: number
}

/** Which version runs and where its source code is. */
export interface About {
  version: string
  sourceUrl: string
}

/** What the authenticator app needs while setting up two-factor login. */
export interface TotpSetup {
  /** Base32, to type in instead of scanning. */
  secret: string
  otpauthUrl: string
  qrSvg: string
}

/** Changing the password in Settings. */
export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

/** The first account; `name` becomes your own person. */
export interface SetupInput extends LoginInput {
  name: string
}

type Editable<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

// Inputs are what the API accepts. Updates replace all editable fields (PUT).
/** Archiving has its own route, like the photo. */
export type PersonInput = Omit<Editable<Person>, 'isSelf' | 'photo' | 'archivedAt'>
/** Archiving has its own route. */
export type GroupInput = Omit<Editable<Group>, 'archivedAt'>
export type MembershipInput = Omit<Membership, 'createdAt'>
export type ActivityInput = Editable<Activity>
/** Creating a point; the person comes from the path, the source can't change later. */
export type NewOpenPointInput = Pick<OpenPoint, 'text' | 'activityId'>
/** Editing a point: only the text. */
export type OpenPointInput = Pick<OpenPoint, 'text'>
/** The person comes from the path; new facts go to the bottom, `sort` changes via reordering only. */
export type FactInput = Pick<Fact, 'label' | 'value'>
