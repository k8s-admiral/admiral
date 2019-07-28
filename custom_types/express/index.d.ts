import * as bunyan from 'bunyan';
import 'express';
declare module 'express' {
  class Request {
    logger: bunyan;
    id: string;
  }
}
