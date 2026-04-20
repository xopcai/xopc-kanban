import clsx from 'clsx';
import { AppLogo } from './AppLogo';
import {
  ChevronRight,
  Globe,
  Info,
  Palette,
  Plus,
  Settings,
  Type,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLocale } from '../i18n/config';
import type { AuthUser } from '../store/authStore';
import {
  useUiStore,
  type TextSize,
  type ThemeMode,
} from '../store/uiStore';

const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];
const TEXT_SIZE_OPTIONS: TextSize[] = ['sm', 'md', 'lg'];

type Flyout = 'language' | 'theme' | 'text' | null;

interface SidebarProfileMenuProps {
  user: AuthUser;
  onLogout: () => void;
  onNewAgent: () => void;
  onOpenAllSettings: () => void;
}

export function SidebarProfileMenu({
  user,
  onLogout,
  onNewAgent,
  onOpenAllSettings,
}: SidebarProfileMenuProps) {
  const { t, i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);
  const textSize = useUiStore((s) => s.textSize);
  const setTextSize = useUiStore((s) => s.setTextSize);

  const displayName =
    user.typ === 'member' ? user.displayName : user.name;
  const locale: AppLocale = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFlyout(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setFlyout(null);
        setAboutOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleMenu = () => {
    setOpen((o) => !o);
    setFlyout(null);
  };

  const rowClass = (active: boolean) =>
    clsx(
      'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg transition-colors duration-150 ease-out',
      active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
    );

  const flyoutPanel = (
    items: { key: string; label: string; selected: boolean; onPick: () => void }[],
  ) => (
    <div className="absolute left-full top-0 z-[60] min-w-[9.5rem] -ml-1 pl-1">
      <div className="rounded-2xl border border-edge-subtle bg-surface-panel py-1 shadow-elevated">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm leading-6 text-fg transition-colors duration-150 hover:bg-surface-hover"
            onClick={() => {
              item.onPick();
              setFlyout(null);
            }}
          >
            <span>{item.label}</span>
            {item.selected && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative mt-auto">
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-edge-subtle bg-surface-panel py-1 shadow-elevated"
          role="menu"
        >
          <div className="relative">
            <div
              className="relative"
              onMouseLeave={() => setFlyout((f) => (f === 'language' ? null : f))}
            >
              <button
                type="button"
                role="menuitem"
                className={rowClass(flyout === 'language')}
                onMouseEnter={() => setFlyout('language')}
                onClick={() =>
                  setFlyout((f) => (f === 'language' ? null : 'language'))
                }
              >
                <Globe className="h-4 w-4 shrink-0 text-fg-secondary" />
                <span className="min-w-0 flex-1">{t('language.label')}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
              </button>
              {flyout === 'language' &&
                flyoutPanel([
                  {
                    key: 'en',
                    label: t('language.en'),
                    selected: locale === 'en',
                    onPick: () => void i18n.changeLanguage('en'),
                  },
                  {
                    key: 'zh',
                    label: t('language.zh'),
                    selected: locale === 'zh',
                    onPick: () => void i18n.changeLanguage('zh'),
                  },
                ])}
            </div>

            <div
              className="relative"
              onMouseLeave={() => setFlyout((f) => (f === 'theme' ? null : f))}
            >
              <button
                type="button"
                role="menuitem"
                className={rowClass(flyout === 'theme')}
                onMouseEnter={() => setFlyout('theme')}
                onClick={() =>
                  setFlyout((f) => (f === 'theme' ? null : 'theme'))
                }
              >
                <Palette className="h-4 w-4 shrink-0 text-fg-secondary" />
                <span className="min-w-0 flex-1">{t('theme.label')}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
              </button>
              {flyout === 'theme' &&
                flyoutPanel(
                  THEME_ORDER.map((mode) => ({
                    key: mode,
                    label: t(`theme.${mode}`),
                    selected: themeMode === mode,
                    onPick: () => setThemeMode(mode),
                  })),
                )}
            </div>

            <div
              className="relative"
              onMouseLeave={() =>
                setFlyout((f) => (f === 'text' ? null : f))
              }
            >
              <button
                type="button"
                role="menuitem"
                className={rowClass(flyout === 'text')}
                onMouseEnter={() => setFlyout('text')}
                onClick={() =>
                  setFlyout((f) => (f === 'text' ? null : 'text'))
                }
              >
                <Type className="h-4 w-4 shrink-0 text-fg-secondary" />
                <span className="min-w-0 flex-1">
                  {t('profile.textSize.label')}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
              </button>
              {flyout === 'text' &&
                flyoutPanel(
                  TEXT_SIZE_OPTIONS.map((size) => ({
                    key: size,
                    label: t(`profile.textSize.${size}`),
                    selected: textSize === size,
                    onPick: () => setTextSize(size),
                  })),
                )}
            </div>
          </div>

          <div className="my-1 border-t border-edge-subtle" />

          {user.typ === 'member' && (
            <button
              type="button"
              role="menuitem"
              className={rowClass(false)}
              onClick={() => {
                onNewAgent();
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4 shrink-0 text-fg-secondary" />
              <span className="min-w-0 flex-1">{t('auth.newAgent')}</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            className={rowClass(false)}
            onClick={() => {
              setAboutOpen(true);
              setOpen(false);
            }}
          >
            <Info className="h-4 w-4 shrink-0 text-fg-secondary" />
            <span className="min-w-0 flex-1">{t('profile.about')}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-accent transition-colors duration-150 ease-out hover:bg-surface-hover"
            onClick={() => {
              onOpenAllSettings();
              setOpen(false);
            }}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t('profile.openAllSettings')}</span>
          </button>

          <div className="my-1 border-t border-edge-subtle" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium leading-6 text-fg-secondary transition-colors duration-150 ease-out hover:bg-surface-hover"
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
          >
            {t('auth.logout')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        className={clsx(
          'flex w-full items-center gap-2 rounded-full px-2 py-2 text-left transition-colors duration-150 ease-out',
          'bg-surface-hover hover:bg-surface-active',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-panel ring-1 ring-edge-subtle">
          <AppLogo className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-5 text-fg">
            {displayName}
          </span>
          <span className="block truncate text-xs leading-5 text-fg-secondary">
            {t('profile.menuHint')}
          </span>
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-panel shadow-sm ring-1 ring-edge-subtle dark:bg-surface-hover"
          aria-hidden
        >
          <Settings className="h-4 w-4 text-accent" />
        </span>
      </button>

      {aboutOpen && (
        <>
          <button
            type="button"
            aria-label={t('profile.closeAbout')}
            className="fixed inset-0 z-[70] bg-[var(--overlay-scrim)]"
            onClick={() => setAboutOpen(false)}
          />
          <div className="fixed left-1/2 top-24 z-[71] w-full max-w-sm -translate-x-1/2 rounded-2xl border border-edge-subtle bg-surface-panel p-4 shadow-elevated">
            <div className="flex items-center gap-3">
              <AppLogo className="h-10 w-10" />
              <h2 className="text-base font-semibold text-fg">{t('app.brand')}</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
              {t('profile.aboutBody')}
            </p>
            <p className="mt-3 text-xs text-fg-subtle">{t('profile.version', { version: '0.1.0' })}</p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
              onClick={() => setAboutOpen(false)}
            >
              {t('auth.close')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
