/**
 * Bounded async byte queue bridging frame capture (producer) and an ffmpeg
 * stdin pump (consumer). push() resolves immediately while the buffered bytes
 * stay under the cap, otherwise it waits for the consumer — so a slow encoder
 * applies backpressure to capture instead of buffering the whole render.
 */
export interface FrameByteQueue extends AsyncIterable<Uint8Array> {
  /** Enqueue one chunk; resolves once the queue is willing to accept more. */
  push(chunk: Uint8Array): Promise<void>;
  /** Signal that no more chunks will arrive; iteration completes after drain. */
  end(): void;
  /** Poison the queue: pending and future pushes and iteration reject with the error. */
  fail(error: unknown): void;
}

export interface CreateFrameByteQueueOptions {
  /** Buffered-byte threshold above which push() waits for the consumer. Default 64 MiB. */
  maxBufferedBytes?: number;
}

const DEFAULT_MAX_BUFFERED_BYTES = 64 * 1024 * 1024;

export function createFrameByteQueue(options: CreateFrameByteQueueOptions = {}): FrameByteQueue {
  const maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
  const chunks: Uint8Array[] = [];
  let bufferedBytes = 0;
  let ended = false;
  let failure: { error: unknown } | null = null;

  let notifyConsumer: (() => void) | null = null;
  const producerWaiters: { resolve(): void; reject(error: unknown): void }[] = [];

  const wakeConsumer = (): void => {
    notifyConsumer?.();
    notifyConsumer = null;
  };

  const releaseProducers = (): void => {
    while (producerWaiters.length > 0 && (failure !== null || bufferedBytes <= maxBufferedBytes)) {
      const waiter = producerWaiters.shift();
      if (waiter === undefined) {
        return;
      }
      if (failure !== null) {
        waiter.reject(failure.error);
      } else {
        waiter.resolve();
      }
    }
  };

  return {
    async push(chunk: Uint8Array): Promise<void> {
      if (failure !== null) {
        throw failure.error;
      }
      if (ended) {
        throw new Error("Cannot push to an ended frame byte queue.");
      }
      const hadCapacity = bufferedBytes < maxBufferedBytes;
      chunks.push(chunk);
      bufferedBytes += chunk.byteLength;
      wakeConsumer();
      if (hadCapacity) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        producerWaiters.push({ resolve, reject });
      });
    },

    end(): void {
      ended = true;
      wakeConsumer();
    },

    fail(error: unknown): void {
      if (failure !== null) {
        return;
      }
      failure = { error };
      chunks.length = 0;
      bufferedBytes = 0;
      wakeConsumer();
      releaseProducers();
    },

    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      while (true) {
        if (failure !== null) {
          throw failure.error;
        }
        const chunk = chunks.shift();
        if (chunk !== undefined) {
          bufferedBytes -= chunk.byteLength;
          releaseProducers();
          yield chunk;
          continue;
        }
        if (ended) {
          return;
        }
        await new Promise<void>((resolve) => {
          notifyConsumer = resolve;
        });
      }
    }
  };
}
