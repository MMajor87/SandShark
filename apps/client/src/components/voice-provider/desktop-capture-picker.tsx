import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@sharkord/ui';
import { AppWindow, Monitor, X } from 'lucide-react';
import { memo } from 'react';

export type TDesktopCaptureSource = {
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnailDataUrl?: string;
};

type TDesktopCapturePickerProps = {
  open: boolean;
  loading: boolean;
  sources: TDesktopCaptureSource[];
  error: string | undefined;
  onSelect: (source: TDesktopCaptureSource) => void;
  onClose: () => void;
};

const DesktopCapturePicker = memo(
  ({
    open,
    loading,
    sources,
    error,
    onSelect,
    onClose
  }: TDesktopCapturePickerProps) => {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent close={onClose} className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Share your screen</DialogTitle>
            <DialogDescription>
              Choose a display or application window to share.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              Loading available sources...
            </div>
          )}

          {!loading && error && (
            <div className="flex h-52 items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && sources.length === 0 && (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              No displays or application windows are available.
            </div>
          )}

          {!loading && !error && sources.length > 0 && (
            <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {sources.map((source) => {
                const Icon = source.type === 'screen' ? Monitor : AppWindow;

                return (
                  <button
                    key={source.id}
                    type="button"
                    className="group overflow-hidden rounded border border-border bg-muted/30 text-left outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelect(source)}
                  >
                    <div className="aspect-video bg-black">
                      {source.thumbnailDataUrl ? (
                        <img
                          src={source.thumbnailDataUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Icon className="size-9" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{source.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              <X className="size-4" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

DesktopCapturePicker.displayName = 'DesktopCapturePicker';

export { DesktopCapturePicker };
