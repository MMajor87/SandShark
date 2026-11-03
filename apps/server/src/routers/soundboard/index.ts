import { t } from '../../utils/trpc';
import { addSoundRoute } from './add-sound';
import { deleteSoundRoute } from './delete-sound';
import {
  onSoundCreateRoute,
  onSoundDeleteRoute,
  onSoundPlayRoute,
  onSoundUpdateRoute
} from './events';
import { playSoundRoute } from './play-sound';
import { updateSoundRoute } from './update-sound';

export const soundboardRouter = t.router({
  add: addSoundRoute,
  update: updateSoundRoute,
  delete: deleteSoundRoute,
  play: playSoundRoute,
  onCreate: onSoundCreateRoute,
  onUpdate: onSoundUpdateRoute,
  onDelete: onSoundDeleteRoute,
  onPlay: onSoundPlayRoute
});
