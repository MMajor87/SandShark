import { useSelector } from 'react-redux';
import { customEmojisSelector } from './selectors';

export const useCustomEmojis = () => useSelector(customEmojisSelector);
