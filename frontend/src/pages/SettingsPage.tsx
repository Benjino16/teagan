import { ChevronRight, Code, ExternalLink, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { readThemePreference, THEME_CHOICES } from '../app/theme'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { Button, IconBadge, ListCard, listRowStyles, MediaRow, SectionHeader } from '../components/ui'
import { useAbout, useAccount, useLogout } from '../data/queries'

/** Fourth tab: own account, appearance, logout and which version runs. */
export function SettingsPage() {
  const account = useAccount()
  const about = useAbout()
  const logout = useLogout()
  const theme = THEME_CHOICES.find((choice) => choice.value === readThemePreference())!

  if (account.isPending) return <PageLoading />
  if (account.isError) return <PageError message="Couldn't load your account." />

  const { totpEnabled, recoveryCodesLeft } = account.data
  const twoFactor = totpEnabled
    ? `On · ${recoveryCodesLeft === 1 ? '1 recovery code' : `${recoveryCodesLeft} recovery codes`} left`
    : 'Off'

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 px-5 pt-6">
        <section aria-labelledby="settings-account" className="flex flex-col gap-3">
          <SectionHeader id="settings-account" title="Account" />
          <ListCard>
            <li className={listRowStyles}>
              <MediaRow
                leading={<IconBadge icon={UserRound} size={36} />}
                title={account.data.username}
                subtitle="Logged in"
              />
            </li>
            <li>
              <Link to="/settings/password" className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
                <MediaRow
                  leading={<IconBadge icon={KeyRound} size={36} />}
                  title="Password"
                  trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                />
              </Link>
            </li>
            <li>
              <Link to="/settings/two-factor" className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
                <MediaRow
                  leading={<IconBadge icon={ShieldCheck} size={36} />}
                  title="Two-factor login"
                  subtitle={twoFactor}
                  trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                />
              </Link>
            </li>
          </ListCard>
        </section>

        <section aria-labelledby="settings-device" className="flex flex-col gap-3">
          <SectionHeader id="settings-device" title="This device" />
          <ListCard>
            <li>
              <Link to="/settings/appearance" className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
                <MediaRow
                  leading={<IconBadge icon={theme.icon} size={36} />}
                  title="Appearance"
                  subtitle={theme.label}
                  trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                />
              </Link>
            </li>
          </ListCard>
        </section>

        <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
          Log out
        </Button>
        {logout.error && (
          <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
            {logout.error.message}
          </p>
        )}

        {about.data && (
          <section aria-labelledby="settings-about" className="flex flex-col gap-3">
            <SectionHeader id="settings-about" title="About" />
            <ListCard>
              <li>
                <a
                  href={about.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${listRowStyles} text-ink no-underline hover:bg-hover`}
                >
                  <MediaRow
                    leading={<IconBadge icon={Code} size={36} />}
                    title={`Teagan ${about.data.version}`}
                    subtitle="Free software · Source code on GitHub"
                    trailing={<ExternalLink aria-hidden="true" size={18} className="flex-none text-muted" />}
                  />
                </a>
              </li>
            </ListCard>
          </section>
        )}
      </div>
    </>
  )
}
