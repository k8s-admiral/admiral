import {
  KubernetesObject,
  V1APIGroupList,
  V1APIResource,
  V1APIResourceList,
} from '@kubernetes/client-node';
import { User as K8SUser } from '@kubernetes/client-node/dist/config_types';
import { AxiosInstance } from 'axios';
import { Cache } from 'cache-manager';
import { inject, injectable } from 'inversify';
import { Logger } from 'pino';
import { ClusterConfig } from '../config/models';
import { HTTPClientFactoryMethod } from '../factories/httpClient';
import { LOG } from '../util/logger';
import { types } from '../util/types';
import { APILookupTable, URLBuilder } from './lookupTable';

// Each kubernetes facade represents a single kubernetes cluster. A single HTTP client will be used.
// Each request should be logged / audited.
@injectable()
export class KubernetesClient {
  private logger: Logger;
  private client: AxiosInstance;

  constructor(
    private clusterName: string,
    cluster: ClusterConfig,
    user: K8SUser,
    @inject(types.Cache.ClusterAPILookup) private apiLookupCache: Cache,
    @inject(types.Factory.HttpClient) clientFactory: HTTPClientFactoryMethod
  ) {
    this.logger = LOG('ClusterClient:' + clusterName);
    //TODO: respect all options coming from kubernetes config.
    //TODO: better validation
    this.client = clientFactory('Cluster:' + clusterName, cluster.connection.server, {
      auth: {
        username: user.username || '',
        password: user.password || '',
      },
    });
  }

  //TODO: return undefined on 404
  async getNamespacedResource<T extends KubernetesObject>(
    kind: string,
    apiVersion: string,
    namespace: string,
    name: string
  ): Promise<T> {
    const url = await this.buildNamespacedUrl(kind, apiVersion, namespace, name);
    //TODO: better error handling
    const response = await this.client.get(url);
    return response.data;
  }

  async createNamespacedResource<T extends KubernetesObject>(obj: T): Promise<T> {
    //TODO: better error handling
    const url = await this.buildNamespacedUrl(obj.kind!, obj.apiVersion!, obj.metadata!.namespace!);
    const response = await this.client.post(url, obj);
    return response.data;
  }

  async updateNamespacedResource<T extends KubernetesObject>(obj: T): Promise<T> {
    //TODO: better error handling
    //TODO: updates need to handle kubernetes locks. (they need to preserve the metadata.resourceVersion)
    const url = await this.buildNamespacedUrl(
      obj.kind!,
      obj.apiVersion!,
      obj.metadata!.namespace!,
      obj.metadata!.name!
    );
    const response = await this.client.put(url, obj);
    return response.data;
  }

  async deleteNamespacedResource(
    kind: string,
    apiVersion: string,
    namespace: string,
    name: string
  ) {
    //TODO: better error handling
    const url = await this.buildNamespacedUrl(kind, apiVersion, namespace, name);
    const response = await this.client.delete(url);
    return response.data;
  }

  private async buildNamespacedUrl(
    kind: string,
    apiVersion: string,
    namespace: string,
    name?: string
  ): Promise<string> {
    const builder = await this.getBuilderOrError(apiVersion, kind);
    if (!builder.isNamespaced) {
      //TODO: better nesting errors
      throw new Error(
        `Resource of kind: [${kind}] and apiVersion: [${apiVersion}] is unexpectedly NOT namespaced.`
      );
    } else {
      return builder.buildNamespacedURL(namespace, name);
    }
  }

  //TODO: return undefined on 404
  async getClusterResource<T extends KubernetesObject>(
    kind: string,
    apiVersion: string,
    name: string
  ): Promise<T> {
    //TODO: better error handling.
    const url = await this.buildClusterUrl(kind, apiVersion, name);
    const response = await this.client.get(url);
    return response.data;
  }

  async createClusterResource<T extends KubernetesObject>(obj: T): Promise<T> {
    //TODO: better error handling.
    const url = await this.buildClusterUrl(obj.kind!, obj.apiVersion!);
    const response = await this.client.post(url, obj);
    return response.data;
  }

  async updateClusterResource<T extends KubernetesObject>(obj: T): Promise<T> {
    //TODO: better error handling.
    //TODO: updates need to handle kubernetes locks. (they need to preserve the metadata.resourceVersion)
    const url = await this.buildClusterUrl(obj.kind!, obj.apiVersion!, obj.metadata!.name!);
    const response = await this.client.put(url, obj);
    return response.data;
  }

  async deleteClusterResource<T extends KubernetesObject>(
    kind: string,
    apiVersion: string,
    name: string
  ): Promise<T> {
    //TODO: better error handling.
    const url = await this.buildClusterUrl(kind, apiVersion, name);
    const response = await this.client.delete(url);
    return response.data;
  }

  private async buildClusterUrl(kind: string, apiVersion: string, name?: string): Promise<string> {
    const builder = await this.getBuilderOrError(apiVersion, kind);
    if (builder.isNamespaced) {
      throw new Error(
        `Resource of kind: [${kind}] and apiVersion: [${apiVersion}] is unexpectedly namespaced.`
      );
    } else {
      return builder.buildClusterURL(name);
    }
  }

  private async getBuilderOrError(apiVersion: string, kind: string) {
    const builder = (await this.getLookupTable()).getBuilder(apiVersion, kind);
    if (!builder) {
      //TODO: Better nesting errors
      throw new Error(
        `No resource of kind: [${kind}] and apiVersion: [${apiVersion}] available on cluster: [${
          this.clusterName
        }]`
      );
    } else {
      return builder;
    }
  }

  private async getLookupTable(): Promise<APILookupTable> {
    //TODO: If this gets cached to a non memory cache it will need to be refactored.
    //TODO: We need to bust the cache any time we create a CustomResourceDefinition.
    return this.apiLookupCache.wrap<APILookupTable>(this.clusterName, async () => {
      const lookupTable = new APILookupTable();
      //TODO: handle errors.
      let apiProm = this.client.get('api/v1').then(response => {
        const resources: V1APIResourceList = response.data;
        resources.resources.filter(this.isOperatableResource).forEach(resource => {
          //TODO: make dry AddToLookupTable
          lookupTable.addURLBuilder(
            'v1',
            resource.kind,
            new URLBuilder(resource.namespaced, resources.groupVersion, resource.name)
          );
        });
      });
      //TODO: cleanup mountain range
      let apisProm = this.client.get('apis').then(async response => {
        const groupList: V1APIGroupList = response.data;
        return Promise.all(
          groupList.groups.map(group => {
            return Promise.all(
              group.versions.map(async version => {
                const resources: V1APIResourceList = (await this.client.get(
                  'apis/' + version.groupVersion
                )).data;
                resources.resources.filter(this.isOperatableResource).forEach(resource => {
                  //TODO: make dry AddToLookupTable
                  lookupTable.addURLBuilder(
                    version.groupVersion,
                    resource.kind,
                    new URLBuilder(resource.namespaced, version.groupVersion, resource.name)
                  );
                });
              })
            );
          })
        );
      });

      await Promise.all([apiProm, apisProm]);
      this.logger.info({ lookupTable }, 'testing lookup table');
      return lookupTable;
    });
  }

  private isOperatableResource(resource: V1APIResource): boolean {
    return (
      resource.verbs.includes('create') &&
      resource.verbs.includes('delete') &&
      resource.verbs.includes('update') &&
      resource.verbs.includes('get')
    );
  }
}
