import { V1Namespace } from '@kubernetes/client-node';
import { injectable } from 'inversify';
import { oc } from 'ts-optchain';

//TODO: consider monkey patching the namespace prototype?
@injectable()
export class NamespaceAnnotationFacade {
  private PREFIX = 'k8s-admiral.dev';
  private TYPE_ANNOTATION = () => `${this.PREFIX}/namespace-type`;

  constructor() {}

  setNSType(namespace: V1Namespace, nsType: string): V1Namespace {
    //TODO: this is easily broken
    const metadata = (namespace.metadata = namespace.metadata || {});
    const annotations = (metadata.annotations = metadata.annotations || {});
    annotations[this.TYPE_ANNOTATION()] = nsType;
    return namespace;
  }

  getNSType(namespace: V1Namespace): string {
    const rtn = oc(namespace).metadata.annotations[this.TYPE_ANNOTATION()](undefined);
    if (rtn === undefined) {
      throw new Error(
        `Namespace [${this.getName(namespace)}] is not managed by Admiral please set `
      );
    }

    return rtn;
  }

  getName(namespace: V1Namespace): string {
    return oc(namespace).metadata.name!;
  }
}
