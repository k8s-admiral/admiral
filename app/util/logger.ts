import * as pino from 'pino';
import { Logger, LoggerOptions } from 'pino';

const level: any = process.env['LOG_LEVEL'] || 'info';

//TODO: Is this even helpful?
type LoggingOptionsSansNameAndLabel = Omit<LoggerOptions, 'name' | 'level'>;

export function LOG(name: string, options: LoggingOptionsSansNameAndLabel | any = {}): Logger {
  return pino({
    name,
    level,
    ...options,
  });
}

//TODO: Should create a separate audit logger? maybe one that is available through a rest endpoint?
