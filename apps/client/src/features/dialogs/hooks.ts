import { useSelector } from 'react-redux';
import { dialogInfoSelector } from './selectors';

export const useDialogInfo = () => useSelector(dialogInfoSelector);
