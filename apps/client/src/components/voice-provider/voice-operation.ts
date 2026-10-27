type TDispose = () => void | Promise<void>;

export const createVoiceOperationOwner = () => {
  let active: ReturnType<typeof begin> | undefined;
  const cancel = () => {
    const operation = active;
    active = undefined;
    operation?.dispose();
  };
  const begin = (isSessionCurrent: () => boolean = () => true) => {
    cancel();
    let disposed = false;
    const releases: TDispose[] = [];
    const release = (dispose: TDispose) => {
      try {
        Promise.resolve(dispose()).catch(console.error);
      } catch (error) {
        console.error(error);
      }
    };
    const isCurrent = (): boolean =>
      !disposed && active === operation && isSessionCurrent();
    const assertCurrent = () => {
      if (!isCurrent())
        throw new DOMException('Voice operation was cancelled.', 'AbortError');
    };
    const own = <T>(
      value: T,
      dispose: (value: T) => void | Promise<void>
    ): T => {
      if (!isCurrent()) {
        release(() => dispose(value));
        assertCurrent();
      }
      releases.push(() => dispose(value));
      return value;
    };
    const wait = async <T>(
      pending: Promise<T>,
      dispose?: (value: T) => void | Promise<void>
    ): Promise<T> => {
      const value = await pending;
      if (dispose) return own(value, dispose);
      assertCurrent();
      return value;
    };
    const operation = {
      isCurrent,
      assertCurrent,
      own,
      wait,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        for (const dispose of releases.splice(0).reverse()) release(dispose);
      }
    };
    active = operation;
    return operation;
  };
  return { begin, cancel };
};

export const stopMediaStream = (stream: MediaStream) => {
  for (const track of stream.getTracks()) {
    track.onended = null;
    track.stop();
  }
};
