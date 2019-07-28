import { Cluster as K8SCluster, User as K8SUser } from '@kubernetes/client-node/dist/config_types';

export interface ArmadaConfig {
  users: { [name: string]: K8SUser };
  clusters: { [name: string]: ClusterConfig };
}

export interface ClusterConfig {
  user: string;
  connection: K8SCluster;
  type: string;
}
