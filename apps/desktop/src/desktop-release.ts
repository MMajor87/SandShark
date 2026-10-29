type TRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string }[];
};

const getDesktopReleaseUrl = async () => {
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(
      `https://api.github.com/repos/MMajor87/SandShark/releases?per_page=100&page=${page}`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!response.ok)
      throw new Error(`Release lookup failed: ${response.status}`);
    const releases: TRelease[] = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid releases response.');
    const release = releases.find(
      ({ tag_name, draft, prerelease }) =>
        !draft &&
        !prerelease &&
        /^sandshark-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag_name)
    );
    if (release) {
      if (!release.assets.some(({ name }) => name === 'latest.yml')) {
        throw new Error('Desktop release is missing latest.yml.');
      }
      return `https://github.com/MMajor87/SandShark/releases/download/${release.tag_name}/`;
    }
    if (releases.length < 100) break;
  }
  throw new Error('No stable desktop release found.');
};

export { getDesktopReleaseUrl };
