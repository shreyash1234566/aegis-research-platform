type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, event: string, payload: LogPayload = {}) {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const serialized = JSON.stringify(record);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function logInfo(event: string, payload: LogPayload = {}) {
  emit("info", event, payload);
}

export function logWarn(event: string, payload: LogPayload = {}) {
  emit("warn", event, payload);
}

export function logError(event: string, payload: LogPayload = {}) {
  emit("error", event, payload);
}
