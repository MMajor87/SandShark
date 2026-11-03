import { useSelector } from 'react-redux';
import { sortedSoundboardSoundsSelector } from './selectors';

export const useSoundboardSounds = () =>
  useSelector(sortedSoundboardSoundsSelector);
