import { t } from '../../utils/trpc';
import { deleteFileRoute } from './delete-file';
import { deleteTemporaryFileRoute } from './delete-temporary-file';
import { refreshFileAccessRoute } from './refresh-access';

export const filesRouter = t.router({
  delete: deleteFileRoute,
  deleteTemporary: deleteTemporaryFileRoute,
  refreshAccess: refreshFileAccessRoute
});
