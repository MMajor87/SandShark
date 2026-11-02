import { openDialog } from '@/features/dialogs/actions';
import { Search } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../dialogs/dialogs';

const ServerSearch = memo(() => {
  const { t } = useTranslation('topbar');
  const openSearchDialog = useCallback(() => {
    openDialog(Dialog.SEARCH);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearchDialog();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearchDialog]);

  return (
    <button
      type="button"
      onClick={openSearchDialog}
      aria-label={t('searchContent')}
      className="ml-1 flex h-7 w-36 items-center gap-2 rounded-md bg-rail px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring xl:w-56"
    >
      <span className="min-w-0 flex-1 truncate text-left">
        {t('searchContent')}
      </span>
      <span className="hidden shrink-0 rounded border border-border px-1 text-[10px] xl:inline">
        Ctrl+K
      </span>
      <Search className="size-4 shrink-0" />
    </button>
  );
});

export { ServerSearch };
