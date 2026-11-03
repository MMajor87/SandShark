import fs from 'fs';
import path from 'path';

// the data folder used to be named after the project this server was forked from.
// moves it to the new name once, so an upgraded server keeps its database instead of
// starting empty. the docker image creates the new folder up front, so an empty new
// folder still counts as not migrated yet.
const migrateLegacyDataPath = (legacyPath: string, dataPath: string) => {
  const hasLegacyDatabase = fs.existsSync(path.join(legacyPath, 'db.sqlite'));
  const hasDatabase = fs.existsSync(path.join(dataPath, 'db.sqlite'));

  if (!hasLegacyDatabase || hasDatabase) {
    return dataPath;
  }

  try {
    if (fs.existsSync(dataPath)) {
      fs.rmdirSync(dataPath);
    }

    fs.renameSync(legacyPath, dataPath);

    console.log(
      'Moved the server data folder from %s to %s',
      legacyPath,
      dataPath
    );

    return dataPath;
  } catch (error) {
    // a docker volume still mounted at the old path cannot be renamed from inside the
    // container, and a non-empty new folder must not be overwritten
    console.warn(
      'Could not move the server data folder from %s to %s (%s). Still using the old folder. Move it, or mount the volume at the new path, to finish the migration.',
      legacyPath,
      dataPath,
      error instanceof Error ? error.message : String(error)
    );

    return legacyPath;
  }
};

export { migrateLegacyDataPath };
