export interface AudioCall {
  method: string;
  args: unknown[];
}

/**
 * AudioContext stand-in for testing what the code asks of the audio graph: every node, param
 * and method exists, method calls are recorded in order, and properties can be set.
 * Unset properties convert to 0, so loops over buffer lengths simply don't run.
 */
export const fakeAudioContext = (currentTime = 0) => {
  const calls: AudioCall[] = [];

  const make = (name: string): unknown => {
    const store: Record<string | symbol, unknown> = {};
    return new Proxy(function () {}, {
      get: (_target, key) => {
        if (key === Symbol.toPrimitive) return () => 0;
        if (!(key in store)) store[key] = make(String(key));
        return store[key];
      },
      set: (_target, key, value) => {
        store[key] = value;
        return true;
      },
      apply: (_target, _this, args) => {
        calls.push({ method: name, args });
        return make(`${name}()`);
      },
    });
  };

  const ctx = make('context') as AudioContext & { currentTime: number };
  ctx.currentTime = currentTime;
  return { ctx, calls };
};
