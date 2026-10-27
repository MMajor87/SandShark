type TDesktopLogDetails = Record<string, boolean | number | string | undefined>;

const sensitiveLogKeyPattern =
  /(token|secret|password|authorization|cookie|session|credential|key)/i;
const messageContentLogKeyPattern = /(message|content|body|text|markdown)/i;

const sanitizeLogDetails = (details: TDesktopLogDetails = {}) =>
  Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (value === undefined) return [key, undefined];
      if (sensitiveLogKeyPattern.test(key)) return [key, '[redacted]'];
      if (messageContentLogKeyPattern.test(key)) return [key, '[omitted]'];
      if (typeof value === 'string') return [key, value.slice(0, 2_000)];

      return [key, value];
    })
  );

export { sanitizeLogDetails, type TDesktopLogDetails };
