import fs from 'fs/promises';
import { setTimeout } from 'timers/promises';

const moveFile = async (src: string, dest: string) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (error) {
      const { code } = error as NodeJS.ErrnoException;

      if (code === 'EXDEV') {
        await fs.copyFile(src, dest);
        await fs.unlink(src);
        return;
      }

      // windows scanners can briefly hold a newly created file or destination.
      if (
        process.platform !== 'win32' ||
        !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') ||
        attempt >= 4
      ) {
        throw error;
      }

      await setTimeout(25 * (attempt + 1));
    }
  }
};

export { moveFile };
