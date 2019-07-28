import { Async, Order, Routerless, Use } from '@fromnibly/hallpass';
import { Request, Response, NextFunction } from 'express';
import { injectable } from 'inversify';

@injectable()
@Routerless()
export class ErrorHandler {
  constructor() {}

  @Order(99)
  @Use()
  uncaughtError(err: Error, req: Request, res: Response, next: NextFunction) {
    req.logger.error(err, 'Uncaught Request Error');
    res.status(500).send({ code: 500, message: err.message });
  }

  @Async()
  @Order(100)
  @Use()
  async noRouteFound(req: Request, res: Response) {
    req.logger.warn(
      { path: req.path, method: req.method, query: req.query, headers: req.headers },
      'Request made with unknown destination'
    );
    res.status(404).send('No route found');
  }
}
