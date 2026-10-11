export function makeBus() {
  const subscribers = new Set();
  const log = [];
  return {
    log,
    on(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    emit(event) {
      const record = { ...event, time: performance.now() };
      log.push(record);
      if (log.length > 600) log.shift();
      for (const fn of subscribers) fn(record);
      return record;
    },
  };
}
