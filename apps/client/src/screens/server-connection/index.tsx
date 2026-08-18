import { beginServerConnection } from '@/features/app/actions';
import { useServerConnectionError } from '@/features/app/hooks';
import { requestConfirmation } from '@/features/dialogs/actions';
import {
  getActiveServerProfileId,
  getServerProfiles,
  removeServerProfile,
  saveServerConnection,
  selectServerProfile,
  type TServerProfile,
  validateServerConnection
} from '@/helpers/server-connection';
import { clearServerSessionByKey } from '@/helpers/server-session';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@sharkord/ui';
import { Pencil, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

type TProfileEditorState = {
  profile?: TServerProfile;
  url: string;
  displayName: string;
};

const ServerConnection = memo(() => {
  const savedConnectionError = useServerConnectionError();
  const [profiles, setProfiles] = useState(() => getServerProfiles());
  const [editor, setEditor] = useState<TProfileEditorState | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const activeProfileId = getActiveServerProfileId();

  const refreshProfiles = useCallback(() => {
    setProfiles(getServerProfiles());
  }, []);

  const connectProfile = useCallback(
    (profileId: string) => {
      if (!selectServerProfile(profileId)) {
        refreshProfiles();
        setError(
          'That saved server is no longer available. Add it again to reconnect.'
        );
        return;
      }

      beginServerConnection();
    },
    [refreshProfiles]
  );

  const openCreate = useCallback(() => {
    setError(undefined);
    setEditor({ url: '', displayName: '' });
  }, []);

  const openEdit = useCallback((profile: TServerProfile) => {
    setError(undefined);
    setEditor({
      profile,
      url: profile.httpUrl,
      displayName: profile.displayName ?? ''
    });
  }, []);

  const closeEditor = useCallback(() => {
    if (!loading) setEditor(undefined);
  }, [loading]);

  const submitEditor = useCallback(async () => {
    if (!editor) return;

    setLoading(true);
    setError(undefined);

    try {
      const { config, icon } = await validateServerConnection(editor.url);
      const profile = saveServerConnection(
        {
          ...config,
          displayName: editor.displayName.trim() || config.displayName
        },
        {
          existingProfileId: editor.profile?.id,
          icon,
          preferences: editor.profile?.preferences
        }
      );

      refreshProfiles();
      setEditor(undefined);

      if (!editor.profile) {
        connectProfile(profile.id);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not validate the Sharkord server.'
      );
    } finally {
      setLoading(false);
    }
  }, [connectProfile, editor, refreshProfiles]);

  const removeProfile = useCallback(
    async (profile: TServerProfile) => {
      const confirmed = await requestConfirmation({
        title: 'Remove server?',
        message: `Remove ${profile.displayName ?? profile.httpUrl} and its saved session?`,
        confirmLabel: 'Remove'
      });

      if (!confirmed) return;

      clearServerSessionByKey(profile.id);
      removeServerProfile(profile.id);
      refreshProfiles();
    },
    [refreshProfiles]
  );

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <img
          src={`${import.meta.env.BASE_URL}sandshark.png`}
          alt=""
          className="h-[min(72vw,72vh)] w-[min(72vw,72vh)] object-contain opacity-[0.08]"
        />
      </div>

      <Card className="relative z-10 w-full max-w-xl bg-card/95">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Connect SandShark</CardTitle>
          <Button
            size="icon"
            variant="outline"
            onClick={openCreate}
            aria-label="Add server"
            title="Add server"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Server className="h-5 w-5" />
              <span>Add a Sharkord server to get started.</span>
              <Button size="sm" onClick={openCreate}>
                Add server
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex items-center gap-3 px-3 py-3 ${
                    profile.id === activeProfileId ? 'bg-accent/50' : ''
                  }`}
                >
                  {profile.icon ? (
                    <img
                      src={profile.icon}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <Server className="h-8 w-8 rounded border p-2 text-muted-foreground" />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => connectProfile(profile.id)}
                  >
                    <div className="truncate text-sm font-medium">
                      {profile.displayName ?? profile.httpUrl}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {profile.httpUrl} - Last used{' '}
                      {new Date(profile.lastConnected).toLocaleString()}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => connectProfile(profile.id)}
                    aria-label={`Reconnect to ${profile.displayName ?? profile.httpUrl}`}
                    title="Reconnect"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(profile)}
                    aria-label={`Edit ${profile.displayName ?? profile.httpUrl}`}
                    title="Edit server"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void removeProfile(profile)}
                    aria-label={`Remove ${profile.displayName ?? profile.httpUrl}`}
                    title="Remove server"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {savedConnectionError && (
            <p className="text-sm text-destructive">{savedConnectionError}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent close={closeEditor}>
          <DialogHeader>
            <DialogTitle>
              {editor?.profile ? 'Edit Sharkord Server' : 'Add Sharkord Server'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-url">Sharkord server URL</Label>
              <Input
                id="server-url"
                value={editor?.url ?? ''}
                placeholder="https://chat.example.com"
                autoComplete="url"
                onChange={(event) =>
                  setEditor((current) =>
                    current ? { ...current, url: event.target.value } : current
                  )
                }
                onEnter={submitEditor}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-display-name">Display name</Label>
              <Input
                id="server-display-name"
                value={editor?.displayName ?? ''}
                placeholder="Use server name"
                onChange={(event) =>
                  setEditor((current) =>
                    current
                      ? { ...current, displayName: event.target.value }
                      : current
                  )
                }
                onEnter={submitEditor}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={submitEditor}
              disabled={loading || !editor?.url.trim()}
            >
              {loading ? 'Checking server...' : 'Save server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export { ServerConnection };
