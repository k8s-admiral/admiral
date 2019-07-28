import * as prom from 'prom-client';
import { Registry } from 'prom-client';

export class PrometheusFactory {
  constructor() {}

  static createDefault(): Registry {
    let registry = new Registry();
    prom.collectDefaultMetrics({ prefix: '', register: registry });
    return registry;
  }

  static create(): Registry {
    let registry = new Registry();
    return registry;
  }
}
