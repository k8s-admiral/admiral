import { PropertyDatabase, StaticPropertyLoader } from '@fromnibly/config';
import { KubernetesObject, V1Namespace, V1Service } from '@kubernetes/client-node';
import { inject, injectable } from 'inversify';
import * as yaml from 'js-yaml';
import { oc } from 'ts-optchain';
import { ConfigLoader } from '../config/loader';
import { KubernetesClient } from '../facades/kubernetes';
import { NamespaceAnnotationFacade } from '../facades/namespace';
import { KubernetesClientFactoryMethod } from '../factories/kubernetesClient';
import { LOG } from '../util/logger';
import { types } from '../util/types';
import { ResourceConfig, ResourceGroup, VariableMap } from './models';
import { TemplateReader } from './templateReader';
import serveStatic = require('serve-static');

@injectable()
export class NamespaceUpdater {
  private logger = LOG('NamespaceUpdater');

  constructor(
    @inject(types.Factory.KubernetesClient)
    private createKubernetesClient: KubernetesClientFactoryMethod,
    private nsFacade: NamespaceAnnotationFacade,
    private configLoader: ConfigLoader,
    private templateReader: TemplateReader
  ) {}

  async updateNamespace(k8s: KubernetesClient, namespaceName: string): Promise<void> {
    // get the namespace to update.
    const namespace = await k8s.getClusterResource('Namespace', 'v1', namespaceName);

    //TODO: lock namespace for multi admiral armadas

    const nsType = this.nsFacade.getNSType(namespace);

    const nsTypeConfig = await this.configLoader.loadNamespaceType(nsType);

    //TODO: implement "include" logic and "dependency" logic
    // Dependency logic will require creating "stages" to sync the resources in stages.

    this.logger.info({ nsTypeConfig }, 'found nsTypeConfig');

    await Promise.all(
      Object.keys(nsTypeConfig['resource-groups']).map(key =>
        this.updateResourceGroup(k8s, namespace, key, nsTypeConfig['resource-groups'][key])
      )
    );
  }

  private async updateResourceGroup(
    k8s: KubernetesClient,
    namespace: V1Namespace,
    rgName: string,
    rg: ResourceGroup
  ): Promise<void> {
    //TODO: only sync resource groups that need syncing
    await Promise.all(
      Object.keys(rg.resources).map(resourceName =>
        this.updateResource(
          k8s,
          namespace,
          rgName,
          rg.vars,
          resourceName,
          rg.resources[resourceName]
        )
      )
    );
  }

  private async updateResource(
    k8s: KubernetesClient,
    namespace: V1Namespace,
    rgName: string,
    rgVars: VariableMap,
    resourceName: string,
    resourceConfig: ResourceConfig
  ): Promise<void> {
    const props = new PropertyDatabase();

    //TODO: dynamic template var property source (and others?). maybe cache this merging?
    props
      .withPropertyLoader(
        new StaticPropertyLoader({
          name: rgName,
          resourceName: resourceName,
          resourceGroupName: rgName,
          namespace: oc(namespace).metadata.name(''),
        })
      )
      .whichOverrides(new StaticPropertyLoader(resourceConfig.vars))
      .whichOverrides(new StaticPropertyLoader(rgVars));

    //TODO: parallelism opportunities.
    await props.loadProperties();

    const vars = props.get().asObject();

    const template = await this.templateReader.readTemplate(resourceConfig.path);

    const resource: KubernetesObject = yaml.load(template(vars));

    resource.metadata = resource.metadata || {};

    resource.metadata.namespace = namespace.metadata!.name!;
    resource.metadata.name = rgName;

    //TODO: plugins like adding default metadata

    // Check if there is an existing object.
    //TODO: reconciliation plugins like delete if immutable
    let found = false;
    try {
      //TODO: better validation
      const existingResource = await k8s.getNamespacedResource(
        resource.kind!,
        resource.apiVersion!,
        namespace.metadata!.name!,
        resource!.metadata!.name!
      );
      //if it exists we need to add the resource version.
      //TODO: this should be a plugin
      resource.metadata!.resourceVersion = existingResource.metadata!.resourceVersion;
      found = true;
      //TODO: this should be a plugin
      if (resource.kind === 'Service') {
        (resource as V1Service).spec!.clusterIP = (existingResource as V1Service).spec!.clusterIP;
      }
    } catch (err) {}

    if (!found) {
      //TODO: don't assume error means not found
      this.logger.info({ resource, vars }, 'creating resource');
      await k8s.createNamespacedResource(resource);
      return;
    } else {
      await k8s.updateNamespacedResource(resource);
    }
  }
}
