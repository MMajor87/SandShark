// release notes files keep every version, newest first, under one "# " heading each.
// a published release only shows its own section, not the whole history below it
const getReleaseNotesSection = (notes: string, version?: string) => {
  const normalized = notes.replace(/\r\n/g, '\n');
  const sections = normalized.split(/^(?=# )/m);
  const versionSections = sections.filter((section) =>
    section.startsWith('# ')
  );

  let section = versionSections[0];

  if (version) {
    section = versionSections.find((candidate) => {
      const [heading] = candidate.split('\n');

      return heading?.endsWith(` ${version}`);
    });
  }

  if (!section) {
    throw new Error(
      version
        ? `No release notes section found for ${version}.`
        : 'The release notes have no "# " section.'
    );
  }

  return `${section.trim()}\n`;
};

if (import.meta.main) {
  const [inputPath, outputPath, version] = process.argv.slice(2);

  if (!inputPath || !outputPath) {
    console.error(
      'Usage: bun latest-release-notes.ts <input> <output> [version]'
    );
    process.exit(1);
  }

  const notes = await Bun.file(inputPath).text();

  await Bun.write(outputPath, getReleaseNotesSection(notes, version));
}

export { getReleaseNotesSection };
