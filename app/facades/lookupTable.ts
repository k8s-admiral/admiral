export class APILookupTable {
  private urlBuilders: { [groupKind: string]: MaybeNamespacedURLBuilder } = {};

  addURLBuilder(groupVersion: string, kind: string, urlBuilder: MaybeNamespacedURLBuilder) {
    this.urlBuilders[`${groupVersion}/${kind}`] = urlBuilder;
  }

  getBuilder(groupVersion: string, kind: string): MaybeNamespacedURLBuilder | undefined {
    return this.urlBuilders[`${groupVersion}/${kind}`];
  }
}

interface NamespacedURLBuilder {
  isNamespaced: true;
  buildNamespacedURL(namespace: string, name?: string): string;
}

interface ClusterURLBuilder {
  isNamespaced: false;
  buildClusterURL(name?: string): string;
}

type MaybeNamespacedURLBuilder = NamespacedURLBuilder | ClusterURLBuilder;

export class URLBuilder {
  constructor(
    public isNamespaced: boolean,
    private groupVersion: string | undefined,
    private kindPath: string
  ) {}

  buildNamespacedURL(namespace: string, name: string): string {
    if (!this.groupVersion || this.groupVersion === 'v1') {
      if (name) {
        return `/api/v1/namespaces/${namespace}/${this.kindPath}/${name}`;
      } else {
        return `/api/v1/namespaces/${namespace}/${this.kindPath}`;
      }
    } else {
      if (name) {
        return `/apis/${this.groupVersion}/namespaces/${namespace}/${this.kindPath}/${name}`;
      } else {
        return `/apis/${this.groupVersion}/namespaces/${namespace}/${this.kindPath}`;
      }
    }
  }

  //TODO: cleanup nested logic
  buildClusterURL(name?: string) {
    if (!this.groupVersion || this.groupVersion === 'v1') {
      if (name) {
        return `/api/v1/${this.kindPath}/${name}`;
      } else {
        return `/api/v1/${this.kindPath}`;
      }
    } else {
      if (name) {
        return `/apis/${this.groupVersion}/${this.kindPath}/${name}`;
      } else {
        return `/apis/${this.groupVersion}/${this.kindPath}`;
      }
    }
  }
}
