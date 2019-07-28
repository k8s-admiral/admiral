require('reflect-metadata');
//spacer to keep reflect-metadata on top
import { PropertyDatabase } from '@fromnibly/config';
import { ClassRouter } from '@fromnibly/hallpass';
import { GracefulShutdownManager } from '@moebius/http-graceful-shutdown';
import * as express from 'express';
import { inject, injectable, multiInject } from 'inversify';
import { ConfigLoader } from './config/loader';
import { NamespaceAnnotationFacade } from './facades/namespace';
import { KubernetesClientFactoryMethod } from './factories/kubernetesClient';
import { NamespaceUpdater } from './templates/namespaceUpdater';
import { create } from './util/injector';
import { LOG } from './util/logger';
import { Trap } from './util/trap';
import { types } from './util/types';

let logger = LOG('main');

@injectable()
class Main {
  constructor(
    private trap: Trap,
    @multiInject(types.Handlers) private handlers: any[],
    private config: PropertyDatabase,
    private configLoader: ConfigLoader,
    private namespaceUpdater: NamespaceUpdater,
    @inject(types.Factory.KubernetesClient)
    private k8sClientFactory: KubernetesClientFactoryMethod,
    private namespaceFacade: NamespaceAnnotationFacade
  ) {}

  async main() {
    this.trap.init();

    let app = express();

    let router = new ClassRouter(app, LOG('ClassRouter'));

    for (let handler of this.handlers) {
      router.registerRouteHandler(handler);
    }

    router.initializeRoutes();

    let configuredPort = this.config.get('server.http.port').asNumber();
    let server = app.listen(configuredPort, () => {
      logger.info('server is started on port', configuredPort);
    });

    let shutdownManager = new GracefulShutdownManager(server);

    this.trap.addPrestopHook(() => {
      return new Promise<void>(resolve => {
        let shutdownWait = this.config.get('server.http.shutdown.wait');
        setTimeout(() => {
          resolve();
        }, shutdownWait.asNumber() * 1000);
      });
    });

    this.trap.addPrestopHook(() => {
      return new Promise<void>(resolve => {
        shutdownManager.terminate(() => {
          resolve();
        });
      });
    });

    //TODO: move this logic elsewhere.

    const armada = await this.configLoader.loadArmadaConfig();

    await Promise.all(
      Object.keys(armada.clusters).map(async clusterName => {
        const cluster = armada.clusters[clusterName];
        const clusterType = cluster.type;
        const user = armada.users[cluster.user];
        const clusterTypeConfig = await this.configLoader.loadClusterType(clusterType);

        logger.info({ cluster, user }, 'testing');
        const k8s = this.k8sClientFactory(clusterName, cluster, user);

        return Promise.all(
          Object.keys(clusterTypeConfig.namespaces).map(async namespaceName => {
            const namespaceType = clusterTypeConfig.namespaces[namespaceName];
            //create the namespace if it doesn't exist
            try {
              await k8s.getClusterResource('Namespace', 'v1', namespaceName);
            } catch (err) {
              const nsObj = {
                kind: 'Namespace',
                apiVersion: 'v1',
                metadata: {
                  name: namespaceName,
                },
              };

              this.namespaceFacade.setNSType(nsObj, namespaceType.type);

              logger.info({ nsObj }, 'creating namespace');

              await k8s.createClusterResource(nsObj);
            }

            return this.namespaceUpdater.updateNamespace(k8s, namespaceName);
          })
        );
      })
    );
  }
}

create()
  .then(injector => {
    injector.bind(Main).toSelf();
    let main = injector.get(Main);

    return main.main();
  })
  .then(() => {
    logger.info('Server Initialized');
  })
  .catch(err => {
    logger.error(err.stack, 'FATAL_ERROR');
    process.exit(1);
  });
