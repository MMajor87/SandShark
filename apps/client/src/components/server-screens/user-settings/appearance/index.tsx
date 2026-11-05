import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import type { Theme } from '@/components/theme-provider/context';
import { useTheme } from '@/components/theme-provider/use-theme';
import { Group, Tabs, TabsList, TabsTrigger } from '@sandshark/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AccentSwatches } from './accent-swatches';

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, label: 'themeLight' },
  { value: 'dark', icon: Moon, label: 'themeDark' },
  { value: 'system', icon: Monitor, label: 'themeSystem' }
] as const;

const isTheme = (value: string): value is Theme =>
  THEME_OPTIONS.some((option) => option.value === value);

// applied as soon as it is picked, like the language, and kept on this device only
const Appearance = memo(() => {
  const { t } = useTranslation('settings');
  const { theme, setTheme, accent, setAccent } = useTheme();

  const handleThemeChange = useCallback(
    (value: string) => {
      if (isTheme(value)) setTheme(value);
    },
    [setTheme]
  );

  return (
    <SettingsSection
      title={t('appearanceTitle')}
      description={t('appearanceDesc')}
    >
      <Group label={t('themeModeLabel')} description={t('themeModeDesc')}>
        <Tabs value={theme} onValueChange={handleThemeChange}>
          <TabsList>
            {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5 px-3">
                <Icon className="size-4" />
                {t(label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Group>

      <Group label={t('accentLabel')} description={t('accentDesc')}>
        <AccentSwatches value={accent} onChange={setAccent} />
      </Group>
    </SettingsSection>
  );
});

export { Appearance };
