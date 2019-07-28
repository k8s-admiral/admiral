export type IncludeMap = { [rgName: string]: boolean | 'depsOnly' };

export type VariableMap = { [key: string]: string | VariableMap };

export interface NamespaceType {
  include: IncludeMap;
  'resource-groups': { [rgName: string]: ResourceGroup };
}

export interface ClusterType {
  include: IncludeMap;
  namespaces: { [nName: string]: { type: string; ref: string } };
  'resource-groups': { [rgName: string]: ResourceGroup };
}

export interface ResourceConfig {
  path: string;
  vars: VariableMap;
}

export interface ResourceGroup {
  vars: VariableMap;
  resources: { [name: string]: ResourceConfig };
}
