import { FileText, FlaskConical, Loader2, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'ui'

import { ButtonTooltip } from '../ui/ButtonTooltip'
import { useFeaturePreviewModal } from '@/components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import { ProfileImage } from '@/components/ui/ProfileImage'
import { useIsPlatformAdminQuery } from '@/data/admin/use-is-platform-admin-query'
import { useProfileNameAndPicture } from '@/lib/profile'
import { executeThemeTransition } from '@/lib/theme-transition'

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
]

export function UserDropdown({
  triggerClassName,
  contentClassName,
}: {
  triggerClassName?: string
  contentClassName?: string
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { username, avatarUrl, primaryEmail, isLoading } = useProfileNameAndPicture()
  const { data: whoami } = useIsPlatformAdminQuery()
  const isAdmin = whoami?.is_admin ?? false
  const { toggleFeaturePreviewModal } = useFeaturePreviewModal()

  const [selectedTimezone, setSelectedTimezone] = useState<string>('auto')
  const [detectedTimezone, setDetectedTimezone] = useState<string>('Asia/Dhaka')

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka'
      setDetectedTimezone(detected)
      const stored = window.localStorage.getItem('socket-preferred-timezone')
      if (stored) setSelectedTimezone(stored)
    } catch {
      // ignore
    }
  }, [])

  const handleTimezoneChange = (val: string) => {
    setSelectedTimezone(val)
    try {
      window.localStorage.setItem('socket-preferred-timezone', val)
    } catch {
      // ignore
    }
  }

  const userDisplayEmail = primaryEmail || username || 'admin@socket.dev'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={cn('border flex-shrink-0 px-3', triggerClassName)}>
        <ButtonTooltip
          type="default"
          className="[&>span]:flex px-0 py-0 rounded-full overflow-hidden h-8 w-8"
          tooltip={{ content: { text: 'Account settings' } }}
        >
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-foreground-lighter" size={16} />
            </div>
          ) : (
            <ProfileImage alt={username || userDisplayEmail} src={avatarUrl} className="w-8 h-8 rounded-md" />
          )}
        </ButtonTooltip>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="bottom" align="end" className={cn('w-56', contentClassName)}>
        <div className="px-2 py-1.5 flex flex-col gap-0 text-sm">
          <span title={userDisplayEmail} className="w-full text-left font-medium text-foreground truncate text-xs">
            {userDisplayEmail}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 text-xs"
            onSelect={() => {
              router.push('/account/me')
            }}
          >
            <User size={14} className="text-foreground-lighter" />
            <span>Account</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 text-xs"
            onSelect={() => {
              toggleFeaturePreviewModal(true)
            }}
          >
            <FlaskConical size={14} className="text-foreground-lighter" />
            <span>Feature previews</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 text-xs"
            onSelect={() => {
              window.open('https://github.com/supabase/supabase/releases', '_blank')
            }}
          >
            <FileText size={14} className="text-foreground-lighter" />
            <span>Changelog</span>
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem
              className="cursor-pointer text-xs"
              onSelect={() => {
                router.push('/admin')
              }}
            >
              Admin
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-foreground-light font-normal py-1">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              executeThemeTransition(value, setTheme)
            }}
          >
            <DropdownMenuRadioItem value="system" className="cursor-pointer text-xs">
              System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="cursor-pointer text-xs">
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light" className="cursor-pointer text-xs">
              Light
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer py-1.5 flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-xs text-foreground-light">Timezone</span>
                <span className="text-xs text-foreground truncate max-w-[130px]">
                  {selectedTimezone === 'auto' ? `Auto (${detectedTimezone})` : selectedTimezone}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto w-60">
              <DropdownMenuRadioGroup value={selectedTimezone} onValueChange={handleTimezoneChange}>
                <DropdownMenuRadioItem value="auto" className="cursor-pointer text-xs">
                  Auto ({detectedTimezone})
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {COMMON_TIMEZONES.map((tz) => (
                  <DropdownMenuRadioItem key={tz.value} value={tz.value} className="cursor-pointer text-xs">
                    {tz.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-xs text-foreground-light hover:text-foreground"
          onSelect={() => {
            router.push('/logout')
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
