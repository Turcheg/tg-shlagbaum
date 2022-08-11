import { LoggerNoop } from "../src/types";

const noop = (): void => {};
export const logger_noop: LoggerNoop = {
  error: noop,
  info: noop,
  trace: noop,
  debug: noop,
  warn: noop,
  child: () => logger_noop,
};
