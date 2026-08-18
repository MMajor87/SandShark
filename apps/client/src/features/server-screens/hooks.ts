import { useSelector } from 'react-redux';
import { serverScreensInfoSelector } from './selectors';

export const useServerScreenInfo = () => useSelector(serverScreensInfoSelector);
