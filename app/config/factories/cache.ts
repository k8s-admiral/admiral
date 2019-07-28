import { Cache, caching, StoreConfig } from 'cache-manager';
import { interfaces } from 'inversify';

export class CacheFactory {
  static createMemoryCache(options?: Partial<StoreConfig>) {
    return (context: interfaces.Context) => {
      //TODO: use config to set up these options
      return caching(
        Object.assign(
          {
            store: 'memory',
            max: 100,
            ttl: 60,
          },
          options || {}
        )
      );
    };
  }
}
