import { Method, Path, RouterPath } from '@fromnibly/hallpass';
import { Request, Response } from 'express';
import { injectable, multiInject } from 'inversify';
import * as prom from 'prom-client';
import { Registry } from 'prom-client';
import { types } from '../../util/types';

@injectable()
@RouterPath('/-/')
export class InternalHandler {
  private registry: Registry;
  constructor(@multiInject(types.Registries) registries: Registry[]) {
    this.registry = prom.Registry.merge(registries);
  }

  @Path('/metrics')
  @Method('get')
  async metrics(req: Request, res: Response) {
    res.status(200).send(this.registry.metrics());
  }

  @Path('/health')
  @Method('get')
  async health(req: Request, res: Response) {
    //Fill in with status about db connections etc.
    res.status(200).send('ok');
  }
}
