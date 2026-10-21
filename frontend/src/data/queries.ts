import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type {
  ActivityInput,
  AuthStatus,
  ChangePasswordInput,
  Group,
  GroupInput,
  Fact,
  FactInput,
  Id,
  LoginInput,
  NewOpenPointInput,
  OpenPoint,
  OpenPointInput,
  Person,
  Membership,
  PersonInput,
  PhotoChange,
  SetupInput,
} from '../domain/model'
import { type MembershipChange, membershipEffects } from '../domain/groups'
import { openPointChanges, type OpenPointDraft } from '../domain/openPoints'
import { type Repository, RepositoryError } from './repository'
import { useRepository } from './RepositoryContext'

/** Central query keys; prefixes allow targeted invalidation. */
export const queryKeys = {
  auth: ['auth'] as const,
  demoLogin: ['demoLogin'] as const,
  about: ['about'] as const,
  account: ['account'] as const,
  people: ['people'] as const,
  person: (id: Id) => ['people', id] as const,
  self: ['self'] as const,
  groups: ['groups'] as const,
  memberships: ['memberships'] as const,
  activities: ['activities'] as const,
  activitiesForPerson: (personId: Id) => ['activities', 'person', personId] as const,
  activitiesForGroups: ['activities', 'group'] as const,
  activitiesForGroup: (groupId: Id) => ['activities', 'group', groupId] as const,
  activity: (id: Id) => ['activities', 'detail', id] as const,
  openPoints: (personId: Id) => ['openPoints', personId] as const,
  openPointsForActivity: (activityId: Id) => ['openPoints', 'activity', activityId] as const,
  facts: (personId: Id) => ['facts', personId] as const,
  factLabels: ['facts', 'labels'] as const,
}

// ── Login ──────────────────────────────────────────────────────────────────

export function useAuthStatus() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.auth, queryFn: () => repo.getAuthStatus(), staleTime: Infinity })
}

export function useLogin() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => repo.login(input),
    // With two-factor login on, the code step comes first
    onSuccess: (result) => {
      if (!result.totpRequired) setLoggedIn(queryClient, true)
    },
  })
}

export function useLoginWithCode() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => repo.loginWithCode(code),
    onSuccess: () => setLoggedIn(queryClient, true),
  })
}

/** Once per page load – a missing demo is the normal case, not worth a retry. */
export function useDemoLogin() {
  const repo = useRepository()
  return useQuery({
    queryKey: queryKeys.demoLogin,
    queryFn: () => repo.getDemoLogin(),
    staleTime: Infinity,
    retry: false,
  })
}

export function useSetup() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetupInput) => repo.setup(input),
    onSuccess: () => setLoggedIn(queryClient, true),
  })
}

export function useLogout() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repo.logout(),
    onSuccess: () => setLoggedIn(queryClient, false),
  })
}

export function useAbout() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.about, queryFn: () => repo.getAbout(), staleTime: Infinity })
}

export function useAccount() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.account, queryFn: () => repo.getAccount() })
}

export function useChangePassword() {
  const repo = useRepository()
  return useMutation({ mutationFn: (input: ChangePasswordInput) => repo.changePassword(input) })
}

export function useStartTotp() {
  const repo = useRepository()
  return useMutation({ mutationFn: () => repo.startTotp() })
}

// The account shows whether two-factor login is on and how many codes are left.
export function useConfirmTotp() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => repo.confirmTotp(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.account }),
  })
}

export function useDisableTotp() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => repo.disableTotp(password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.account }),
  })
}

export function useRenewRecoveryCodes() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => repo.renewRecoveryCodes(password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.account }),
  })
}

/**
 * For the query client's error handlers: an `unauthorized` answer means the
 * login has ended (expired, password changed), so the login screen comes back.
 */
export function handleUnauthorized(queryClient: QueryClient, error: unknown) {
  if (error instanceof RepositoryError && error.code === 'unauthorized') setLoggedIn(queryClient, false)
}

/**
 * Nothing of the previous login may stay in the cache – the next one may be another user.
 * Logging in or out means an account exists, so setup is over.
 */
function setLoggedIn(queryClient: QueryClient, loggedIn: boolean) {
  queryClient.setQueryData<AuthStatus>(queryKeys.auth, { loggedIn, setupRequired: false })
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.auth[0] })
}

// ── Read ───────────────────────────────────────────────────────────────────

export function usePeople() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.people, queryFn: () => repo.listPeople() })
}

export function usePerson(id: Id) {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.person(id), queryFn: () => repo.getPerson(id) })
}

export function useSelf() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.self, queryFn: () => repo.getSelf() })
}

export function useGroups() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.groups, queryFn: () => repo.listGroups() })
}

export function useMemberships() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.memberships, queryFn: () => repo.listMemberships() })
}

export function useActivitiesForPerson(personId: Id) {
  const repo = useRepository()
  return useQuery({
    queryKey: queryKeys.activitiesForPerson(personId),
    queryFn: () => repo.listActivitiesForPerson(personId),
  })
}

export function useActivitiesForGroup(groupId: Id) {
  const repo = useRepository()
  return useQuery({
    queryKey: queryKeys.activitiesForGroup(groupId),
    queryFn: () => repo.listActivitiesForGroup(groupId),
  })
}

export function useActivities() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.activities, queryFn: () => repo.listActivities() })
}

export function useActivity(id: Id) {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.activity(id), queryFn: () => repo.getActivity(id) })
}

export function useOpenPointsForActivity(activityId: Id) {
  const repo = useRepository()
  return useQuery({
    queryKey: queryKeys.openPointsForActivity(activityId),
    queryFn: () => repo.listOpenPointsForActivity(activityId),
  })
}

export function useOpenPoints(personId: Id) {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.openPoints(personId), queryFn: () => repo.listOpenPoints(personId) })
}

export function useFacts(personId: Id) {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.facts(personId), queryFn: () => repo.listFacts(personId) })
}

export function useFactLabels() {
  const repo = useRepository()
  return useQuery({ queryKey: queryKeys.factLabels, queryFn: () => repo.listFactLabels() })
}

// ── Write ──────────────────────────────────────────────────────────────────

/** The person form's data; the photo has its own route, so it goes up after the person. */
export interface PersonSave {
  input: PersonInput
  /** Default: leave the photo as it is. */
  photo?: PhotoChange
}

export function useCreatePerson() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  // Set once the person exists – if only the photo upload failed, a retry must not create a second person
  const created = useRef<Person | null>(null)
  return useMutation({
    mutationFn: async ({ input, photo }: PersonSave) => {
      const person = created.current
        ? await repo.updatePerson(created.current.id, input)
        : await repo.createPerson(input)
      created.current = person
      return savePhoto(repo, person, photo)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.people }),
  })
}

export function useUpdatePerson(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, photo }: PersonSave) => savePhoto(repo, await repo.updatePerson(id, input), photo),
    // Prefix: list and detail; activities show names. Also after a failed photo upload – the person is saved.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people })
      queryClient.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useSetPersonArchived(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (archived: boolean) => repo.setPersonArchived(id, archived),
    // Prefix: list and detail
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.people }),
  })
}

export function useDeletePerson(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repo.deletePerson(id),
    // Facts, open points and photo go with them; events and groups stay, just without them.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.people })
      queryClient.invalidateQueries({ queryKey: queryKeys.activities })
      queryClient.invalidateQueries({ queryKey: queryKeys.memberships })
    },
  })
}

async function savePhoto(repo: Repository, person: Person, photo: PhotoChange = 'keep'): Promise<Person> {
  if (photo === 'keep') return person
  if (photo === 'remove') {
    await repo.deletePersonPhoto(person.id)
    return { ...person, photo: null }
  }
  return repo.setPersonPhoto(person.id, photo)
}

export function useSetMembership() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  const key = queryKeys.memberships
  return useMutation({
    mutationFn: async ({ personId, groupId, member }: MembershipChange) => {
      if (member) await repo.addPersonToGroup({ personId, groupId })
      else await repo.removePersonFromGroup(personId, groupId)
    },
    // Optimistic with the same rules as the repository, rolled back on error.
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Membership[]>(key)
      const groups = queryClient.getQueryData<Group[]>(queryKeys.groups) ?? []
      queryClient.setQueryData<Membership[]>(key, (links) => {
        if (!links) return links
        const { add, remove } = membershipEffects(change, groups, links)
        const added = add.map((groupId) => ({ personId: change.personId, groupId, createdAt: '' }))
        return [...links.filter((m) => !(m.personId === change.personId && remove.includes(m.groupId))), ...added]
      })
      return { previous }
    },
    onError: (_error, _vars, group) => queryClient.setQueryData(key, group?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

// Groups and memberships change together (moves add members, deletes cascade).
// Moving a subgroup also changes which activities its main groups show.
function invalidateGroups(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.groups })
  queryClient.invalidateQueries({ queryKey: queryKeys.memberships })
  queryClient.invalidateQueries({ queryKey: queryKeys.activitiesForGroups })
}

export function useCreateGroup() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupInput) => repo.createGroup(input),
    onSuccess: () => invalidateGroups(queryClient),
  })
}

export function useUpdateGroup(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupInput) => repo.updateGroup(id, input),
    onSuccess: () => invalidateGroups(queryClient),
  })
}

export function useDeleteGroup(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repo.deleteGroup(id),
    onSuccess: () => {
      invalidateGroups(queryClient)
      // Takes the activities that only belonged to the group, the others lose it
      queryClient.invalidateQueries({ queryKey: queryKeys.activities })
    },
  })
}

export function useSetGroupArchived(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (archived: boolean) => repo.setGroupArchived(id, archived),
    onSettled: () => invalidateGroups(queryClient),
  })
}

/** An event together with the open points from the event form. */
export interface ActivityWithPoints {
  activity: ActivityInput
  points: OpenPointDraft[]
}

/**
 * Applies the form's points to the event's existing ones. One request per change, not
 * atomic: if one fails, the earlier ones stay and the form shows the error.
 */
async function saveActivityPoints(repo: Repository, activityId: Id, drafts: OpenPointDraft[]) {
  const changes = openPointChanges(await repo.listOpenPointsForActivity(activityId), drafts)
  for (const id of changes.remove) await repo.deleteOpenPoint(id)
  for (const { id, text } of changes.update) await repo.updateOpenPoint(id, { text })
  for (const { personId, text } of changes.create) await repo.createOpenPoint(personId, { text, activityId })
}

export function useCreateActivity() {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activity, points }: ActivityWithPoints) => {
      const created = await repo.createActivity(activity)
      await saveActivityPoints(repo, created.id, points)
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities })
      queryClient.invalidateQueries({ queryKey: ['openPoints'] })
    },
  })
}

export function useUpdateActivity(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activity, points }: ActivityWithPoints) => {
      const updated = await repo.updateActivity(id, activity)
      await saveActivityPoints(repo, id, points)
      return updated
    },
    // Prefix: lists, person timelines and the detail view.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities })
      queryClient.invalidateQueries({ queryKey: ['openPoints'] })
    },
  })
}

export function useSetOpenPointDone(personId: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: Id; done: boolean }) => repo.setOpenPointDone(id, done),
    // Optimistic: the check mark appears immediately and is rolled back on error.
    onMutate: async ({ id, done }) => {
      const key = queryKeys.openPoints(personId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<OpenPoint[]>(key)
      const doneAt = done ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
      queryClient.setQueryData<OpenPoint[]>(key, (points) =>
        points?.map((p) => (p.id === id ? { ...p, doneAt: done ? (p.doneAt ?? doneAt) : null } : p)),
      )
      return { previous }
    },
    onError: (_error, _vars, group) => {
      queryClient.setQueryData(queryKeys.openPoints(personId), group?.previous)
    },
    // Prefix: also refresh lists in the activity view.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['openPoints'] }),
  })
}

// Prefix: person and activity lists of open points.
export function useCreateOpenPoint(personId: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewOpenPointInput) => repo.createOpenPoint(personId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openPoints'] }),
  })
}

export function useUpdateOpenPoint(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OpenPointInput) => repo.updateOpenPoint(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openPoints'] }),
  })
}

export function useDeleteOpenPoint(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repo.deleteOpenPoint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openPoints'] }),
  })
}

// Prefix: the person's facts and the label suggestions.
export function useCreateFact(personId: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FactInput) => repo.createFact(personId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facts'] }),
  })
}

export function useUpdateFact(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FactInput) => repo.updateFact(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facts'] }),
  })
}

export function useDeleteFact(id: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repo.deleteFact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facts'] }),
  })
}

export function useReorderFacts(personId: Id) {
  const repo = useRepository()
  const queryClient = useQueryClient()
  const key = queryKeys.facts(personId)
  return useMutation({
    mutationFn: (orderedIds: Id[]) => repo.reorderFacts(personId, orderedIds),
    // Optimistic: the row stays where it was dropped and is moved back on error.
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Fact[]>(key)
      queryClient.setQueryData<Fact[]>(key, (facts) => {
        if (!facts) return facts
        const byId = new Map(facts.map((f) => [f.id, f]))
        return orderedIds.flatMap((id, sort) => {
          const fact = byId.get(id)
          return fact ? [{ ...fact, sort }] : []
        })
      })
      return { previous }
    },
    onError: (_error, _ids, group) => queryClient.setQueryData(key, group?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
