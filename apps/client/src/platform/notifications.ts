const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied' as NotificationPermission;
  }

  return Notification.requestPermission();
};

export { requestNotificationPermission };
