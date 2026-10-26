'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SettingsDialog } from '@/components/settings';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { toast } from 'sonner';
import { ieltsAppCopy } from '@/lib/i18n/ielts-app-copy';
import type { SettingsSection } from '@/lib/types/settings';
import { cn } from '@/lib/utils';

const OPEN_SETTINGS_EVENT = 'openmaic:open-settings';

export function requestAppSettings(section?: SettingsSection): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { section } }));
}

export function AppChrome() {
  const { t, locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: SettingsSection }>).detail;
      setSettingsSection(detail?.section);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout failed');
    } catch {
      toast.error(ieltsAppCopy(locale, 'logoutError'));
      return;
    }
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      <div className="fixed right-3 top-3 z-[70] flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/85 px-2 py-1.5 text-slate-600 shadow-lg shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300 md:right-4 md:top-4">
        <LanguageSwitcher onOpen={() => setThemeOpen(false)} />
        <span className="mx-1 h-4 w-px bg-white/15" />
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('settings.themeOptions.system')}
            className="size-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => setThemeOpen((open) => !open)}
          >
            {theme === 'light' ? <Sun className="size-4" /> : theme === 'dark' ? <Moon className="size-4" /> : <Monitor className="size-4" />}
          </Button>
          {themeOpen && (
            <div className="absolute right-0 top-full z-[80] mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl dark:border-white/10 dark:bg-slate-900 dark:text-white">
              {(['light', 'dark', 'system'] as const).map((option) => {
                const Icon = option === 'light' ? Sun : option === 'dark' ? Moon : Monitor;
                return (
                  <button
                    key={option}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/10', theme === option && 'bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200')}
                    onClick={() => { setTheme(option); setThemeOpen(false); }}
                  >
                    <Icon className="size-4" />{t(`settings.themeOptions.${option}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/15" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('settings.title')}
          title={t('settings.title')}
          className="size-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={() => { setSettingsSection(undefined); setSettingsOpen(true); }}
        >
          <Settings className="size-4" />
        </Button>
        {pathname !== '/login' && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/15" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={ieltsAppCopy(locale, 'logout')}
              title={ieltsAppCopy(locale, 'logout')}
              className="size-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
            </Button>
          </>
        )}
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />
    </>
  );
}
