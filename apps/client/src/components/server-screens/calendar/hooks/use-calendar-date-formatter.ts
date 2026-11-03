import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// callers pass a module level options object, so the formatter is only rebuilt when the
// language changes
const useCalendarDateFormatter = (options: Intl.DateTimeFormatOptions) => {
  const { i18n } = useTranslation('calendar');

  return useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage, options),
    [i18n.resolvedLanguage, options]
  );
};

export { useCalendarDateFormatter };
