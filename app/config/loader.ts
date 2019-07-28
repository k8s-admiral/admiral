import { PropertyDatabase } from '@fromnibly/config';
import { Cache } from 'cache-manager';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ClusterType, NamespaceType } from '../templates/models';
import { types } from '../util/types';
import { AnyYAMLFileLoader } from './anyFileLoader';
import { ArmadaConfig } from './models';

//TODO: link this to a git repository

@injectable()
export class ConfigLoader {
  private readonly configRoot: string;

  constructor(
    @inject(types.Cache.ClusterConfig) private clusterConfigCache: Cache,
    @inject(types.Cache.NamespaceType) private namespaceTypeCache: Cache,
    @inject(types.Cache.ClusterType) private clusterTypeCache: Cache,
    config: PropertyDatabase
  ) {
    //TODO: create a git facade to load files instead of plopping this logic all over
    this.configRoot = path.resolve(config.get('git.path').asString());
  }

  //TODO: metrics on initializations of config (how often does this happen)
  //TODO: when to bust the cache?
  //TODO: this should load from and merge property sources
  async loadArmadaConfig(): Promise<ArmadaConfig> {
    const directory = path.join(this.configRoot, 'armada');
    return this.clusterConfigCache.wrap(directory, async () => {
      const props = new PropertyDatabase();
      props.withPropertyLoader(new AnyYAMLFileLoader(directory));
      await props.loadProperties();
      return props.get().asObject();
    });
  }

  async loadClusterType(clusterType: string): Promise<ClusterType> {
    return this.clusterTypeCache.wrap<ClusterType>(clusterType, async () => {
      const props = new PropertyDatabase();
      const pathParts = clusterType.split('/');
      // create property loaders and *then* reverse them so the override is correct
      const propertyLoaders = [];

      // read all the path levels add create a file loader
      while (pathParts.length > 0) {
        const dir = path.join(this.configRoot, 'cluster-types', ...pathParts);
        //TODO: paralellize
        if (await fs.existsSync(dir)) {
          propertyLoaders.push(new AnyYAMLFileLoader(dir));
        }
        pathParts.pop();
      }

      propertyLoaders.push(new AnyYAMLFileLoader(path.join(this.configRoot, 'cluster-types')));

      //reverse it so foo/bar has a higher precedence than foo
      propertyLoaders.reverse().forEach(loader => props.withPropertyLoader(loader));

      await props.loadProperties();

      return props.get().asObject();
    });
  }

  //TODO: this should load from and merge property sources
  async loadNamespaceType(namespaceType: string): Promise<NamespaceType> {
    // foo and foo/bar are distinct namespace types so they need to be cached separately
    return this.namespaceTypeCache.wrap<NamespaceType>(namespaceType, async () => {
      const props = new PropertyDatabase();
      const pathParts = namespaceType.split('/');
      // create property loaders and *then* reverse them so the override is correct
      const propertyLoaders = [];

      // read all the path levels add create a file loader
      while (pathParts.length > 0) {
        const dir = path.join(this.configRoot, 'namespace-types', ...pathParts);
        //TODO: paralellize
        if (await fs.existsSync(dir)) {
          propertyLoaders.push(new AnyYAMLFileLoader(dir));
        }
        pathParts.pop();
      }

      propertyLoaders.push(new AnyYAMLFileLoader(path.join(this.configRoot, 'namespace-types')));

      //reverse it so foo/bar has a higher precedence than foo
      propertyLoaders.reverse().forEach(loader => props.withPropertyLoader(loader));

      await props.loadProperties();

      return props.get().asObject();
    });
  }
}
