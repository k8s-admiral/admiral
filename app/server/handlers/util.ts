import { Async, Indirect, Order, Routerless, Use } from '@fromnibly/hallpass';
import * as bodyParser from 'body-parser';
import { NextFunction } from 'connect';
import { Request, Response } from 'express';
import * as helmet from 'helmet';
import { inject, injectable } from 'inversify';
import { Registry, Summary } from 'prom-client';
import * as shortid from 'shortid';
import { LOG } from '../../util/logger';
import { types } from '../../util/types';
let onHeaders = require('on-headers');

@injectable()
@Routerless()
export class UtilHandler {
  private mLatency = new Summary({
    name: 'request_latency',
    help: 'general request latency',
    labelNames: ['method', 'response', 'path'],
    percentiles: [0.25, 0.5, 0.9, 0.99, 0.999, 0.9999],
  });
  constructor(@inject(types.HttpRegistry) registry: Registry) {
    registry.registerMetric(this.mLatency);
  }

  @Order(0)
  @Use()
  trackLatency(req: Request, res: Response, next: NextFunction) {
    let start = new Date();
    let self = this;
    //Using onHeaders means we track how long it takes to send headers not the body
    //When streaming data we don't want to track how long it takes to send the body just how long it took to repond
    onHeaders(res, function() {
      let route = req.route ? req.route.path : '';
      let time = new Date().getTime() - start.getTime();
      let logMethod = req.logger.debug.bind(req.logger);
      if (req.originalUrl.startsWith('/-/')) {
        logMethod = req.logger.trace.bind(req.logger);
      }
      logMethod(
        {
          path: req.originalUrl,
          method: req.method,
          elapsed: time,
        },
        'Request End'
      );
      self.mLatency.labels(req.method, res.statusCode.toString(), route).observe(time);
    });
    next();
  }

  @Async()
  @Order(10)
  @Use()
  async log(req: Request) {
    req.id = shortid.generate();
    req.logger = LOG('Request', { 'req-id': req.id });
    let logMethod = req.logger.debug.bind(req.logger);
    if (req.path.startsWith('/-/')) {
      logMethod = req.logger.trace.bind(req.logger);
    }
    logMethod(
      {
        path: req.path,
        method: req.method,
      },
      'Request Start'
    );
  }

  @Order(20)
  @Indirect()
  @Use()
  helmet() {
    return helmet();
  }

  @Order(30)
  @Indirect()
  @Use()
  bodyParser() {
    return bodyParser.json({ strict: true });
  }
}
