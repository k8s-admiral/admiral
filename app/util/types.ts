export const types = {
  Handlers: Symbol('Handlers'),
  Registries: Symbol('Registries'),
  HttpRegistry: Symbol('HttpRegistry'),
  Cache: {
    ClusterConfig: Symbol('ClusterConfigCache'),
    NamespaceType: Symbol('NamespaceTypeCache'),
    ClusterType: Symbol('ClusterTypeCache'),
    ClusterAPILookup: Symbol('ClusterAPILookup'),
  },
  Factory: {
    HttpClient: Symbol('HTTPClientFactory'),
    KubernetesClient: Symbol('KubernetesClientFactory'),
  },
};
