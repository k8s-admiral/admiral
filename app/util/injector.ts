import { EnvironmentPropertyLoader, FilePropertyLoader, PropertyDatabase } from '@fromnibly/config';
import { Container } from 'inversify';
import { CacheFactory } from '../config/factories/cache';
import { ConfigLoader } from '../config/loader';
import { NamespaceAnnotationFacade } from '../facades/namespace';
import { HTTPClientFactory } from '../factories/httpClient';
import { KubernetesClientFactory } from '../factories/kubernetesClient';
import { ErrorHandler } from '../server/handlers/error';
import { InternalHandler } from '../server/handlers/internal';
import { UtilHandler } from '../server/handlers/util';
import { NamespaceUpdater } from '../templates/namespaceUpdater';
import { TemplateReader } from '../templates/templateReader';
import { PrometheusFactory } from './../factories/prometheus';
import { Trap } from './trap';
import { types } from './types';

export async function create(): Promise<Container> {
  let container = new Container();

  let config = new PropertyDatabase((process.env['PROFILES'] || '').split(',').filter(x => x));
  config
    .withPropertyLoader(new EnvironmentPropertyLoader(process.env))
    .whichOverrides(new FilePropertyLoader('./config'));

  await config.loadProperties();

  container.bind(PropertyDatabase).toConstantValue(config);

  container
    .bind(ConfigLoader)
    .toSelf()
    .inSingletonScope();

  //client factory
  container.bind(types.Factory.HttpClient).toFactory(HTTPClientFactory.createClient);
  container.bind(types.Factory.KubernetesClient).toFactory(KubernetesClientFactory.createClient);

  //caches
  container
    .bind(types.Cache.ClusterConfig)
    .toDynamicValue(CacheFactory.createMemoryCache())
    .inSingletonScope();
  container
    .bind(types.Cache.NamespaceType)
    .toDynamicValue(CacheFactory.createMemoryCache())
    .inSingletonScope();
  container
    .bind(types.Cache.ClusterType)
    .toDynamicValue(CacheFactory.createMemoryCache())
    .inSingletonScope();
  // cluster lookup table cache
  container
    .bind(types.Cache.ClusterAPILookup)
    .toDynamicValue(CacheFactory.createMemoryCache({ ttl: Infinity }))
    .inSingletonScope();

  // core config management
  container
    .bind(NamespaceAnnotationFacade)
    .toSelf()
    .inSingletonScope();
  container
    .bind(NamespaceUpdater)
    .toSelf()
    .inSingletonScope();
  container
    .bind(TemplateReader)
    .toSelf()
    .inSingletonScope();

  // prometheus registries
  container
    .bind(types.Registries)
    .toDynamicValue(PrometheusFactory.createDefault)
    .inSingletonScope();

  let HttpRegistry = PrometheusFactory.create();
  container.bind(types.Registries).toConstantValue(HttpRegistry);
  container.bind(types.HttpRegistry).toConstantValue(HttpRegistry);

  // handlers
  container
    .bind<any>(types.Handlers)
    .to(UtilHandler)
    .inSingletonScope();
  container
    .bind<any>(types.Handlers)
    .to(InternalHandler)
    .inSingletonScope();

  // Error handler goes last
  container
    .bind<any>(types.Handlers)
    .to(ErrorHandler)
    .inSingletonScope();

  // trap signals when in docker container
  container
    .bind(Trap)
    .toSelf()
    .inSingletonScope();

  return container;
}
