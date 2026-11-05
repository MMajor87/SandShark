// the browser half of the starter plugin, see docs/plugins.md. it is loaded as a module from
// the server as it is, so it has no bare imports: react and the host store come from window.
// a plugin built from typescript bundles to the same shape

const React = window.__SANDSHARK_REACT__;
const store = window.__SANDSHARK_STORE__;

const PLUGIN_ID = 'hello-sandshark';

// shown in user settings, under this plugin's entry
const WavePage = () => {
  const [waves, setWaves] = React.useState(null);
  const [error, setError] = React.useState(null);
  const canWave = store.hooks.useCanUse('action', 'wave');

  const wave = React.useCallback(async () => {
    try {
      const result = await store.actions.executePluginAction(PLUGIN_ID, 'wave');

      setWaves(result.waves);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    React.createElement('p', null, 'Every wave is counted on the server.'),
    React.createElement(
      'button',
      { type: 'button', onClick: wave, disabled: !canWave },
      'Wave'
    ),
    waves !== null &&
      React.createElement('p', null, `Waves so far: ${waves}`),
    error && React.createElement('p', { role: 'alert' }, error)
  );
};

export const components = {
  user_settings: [WavePage]
};
