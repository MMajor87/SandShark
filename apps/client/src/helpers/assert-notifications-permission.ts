import { isDesktopClient } from '@/platform/environment';
import { requestNotificationPermission } from '@/platform/notifications';
import { toast } from 'sonner';

const assertNotificationsPermission = async () => {
  if (isDesktopClient() && window.sandSharkDesktop) return;

  if ('Notification' in window) {
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      toast.error('Notification permission was denied.');

      return;
    }
  }
};

export { assertNotificationsPermission };
