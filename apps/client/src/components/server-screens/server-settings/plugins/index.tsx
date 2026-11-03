import type { TPluginInfo } from '@sandshark/shared';
import { memo } from 'react';
import { InstalledPlugins } from './installed';

type TPluginsProps = {
  plugins: TPluginInfo[];
  loading: boolean;
  refetch: () => Promise<void>;
};

const Plugins = memo(({ plugins, loading, refetch }: TPluginsProps) => {
  return (
    <InstalledPlugins plugins={plugins} loading={loading} refetch={refetch} />
  );
});

export { Plugins };
