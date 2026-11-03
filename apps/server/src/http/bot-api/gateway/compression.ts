import zlib from 'node:zlib';

// discord's `compress=zlib-stream`: one deflate context for the whole connection, each
// payload flushed with Z_SYNC_FLUSH so it ends in the 00 00 ff ff suffix the libraries
// split on. discord.py asks for it by default. writes are queued so payloads never
// interleave inside the shared context
const createZlibStream = () => {
  const deflate = zlib.createDeflate({ chunkSize: 64 * 1024 });
  let queue: Promise<unknown> = Promise.resolve();

  const compress = (data: string) => {
    const next = queue.then(
      () =>
        new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const onData = (chunk: Buffer) => chunks.push(chunk);

          deflate.on('data', onData);
          deflate.once('error', reject);
          deflate.write(data);
          deflate.flush(zlib.constants.Z_SYNC_FLUSH, () => {
            deflate.off('data', onData);
            deflate.off('error', reject);
            resolve(Buffer.concat(chunks));
          });
        })
    );

    queue = next.catch(() => {});

    return next;
  };

  const close = () => deflate.close();

  return { compress, close };
};

export { createZlibStream };
