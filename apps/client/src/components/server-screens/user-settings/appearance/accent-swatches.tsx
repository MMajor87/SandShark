import { ACCENTS, type TAccent } from '@/components/theme-provider/accents';
import { cn, Tooltip } from '@sandshark/ui';
import { Check } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type TAccentSwatchProps = {
  accent: TAccent;
  selected: boolean;
  onSelect: (accent: TAccent) => void;
};

// data-accent gives the swatch that preset's colors from index.css, whatever accent the app
// itself uses
const AccentSwatch = memo(
  ({ accent, selected, onSelect }: TAccentSwatchProps) => {
    const { t } = useTranslation('settings');
    const label = t(`accent_${accent}`);

    const handleClick = useCallback(() => {
      onSelect(accent);
    }, [accent, onSelect]);

    return (
      <Tooltip content={label}>
        <button
          type="button"
          data-accent={accent}
          aria-label={label}
          aria-pressed={selected}
          onClick={handleClick}
          className={cn(
            'flex size-8 items-center justify-center rounded-full bg-[var(--highlight-light)] text-white transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-[var(--highlight-dark)] dark:text-black',
            selected &&
              'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          )}
        >
          {selected && <Check className="size-4" />}
        </button>
      </Tooltip>
    );
  }
);

type TAccentSwatchesProps = {
  value: TAccent;
  onChange: (accent: TAccent) => void;
};

const AccentSwatches = memo(({ value, onChange }: TAccentSwatchesProps) => (
  <div className="flex flex-wrap gap-3">
    {ACCENTS.map((accent) => (
      <AccentSwatch
        key={accent}
        accent={accent}
        selected={accent === value}
        onSelect={onChange}
      />
    ))}
  </div>
));

export { AccentSwatches };
