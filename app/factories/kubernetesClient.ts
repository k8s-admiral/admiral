import { User as K8SUser } from '@kubernetes/client-node/dist/config_types';
import { Cache } from 'cache-manager';
import { interfaces } from 'inversify';
import { ClusterConfig } from '../config/models';
import { KubernetesClient } from '../facades/kubernetes';
import { types } from '../util/types';
import { HTTPClientFactoryMethod } from './httpClient';

export type KubernetesClientFactoryMethod = (
  clusterName: string,
  cluster: ClusterConfig,
  user: K8SUser
) => KubernetesClient;

//TODO: cache the clients?
export class KubernetesClientFactory {
  static createClient(context: interfaces.Context): KubernetesClientFactoryMethod {
    const apiLookupCache: Cache = context.container.get(types.Cache.ClusterAPILookup);
    const clientFactory: HTTPClientFactoryMethod = context.container.get(types.Factory.HttpClient);
    return (clusterName: string, cluster: ClusterConfig, user: K8SUser) => {
      return new KubernetesClient(clusterName, cluster, user, apiLookupCache, clientFactory);
    };
  }
}
