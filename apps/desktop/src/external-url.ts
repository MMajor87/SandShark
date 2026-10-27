const isSafeExternalUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2_048) return false;

  try {
    const url = new URL(value);

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export { isSafeExternalUrl };
