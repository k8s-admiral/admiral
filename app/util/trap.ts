import { injectable } from 'inversify';
import { LOG } from './logger';

//TODO: create npm module from this

@injectable()
export class Trap {
  private logger = LOG('TrapSignal');

  private preStopHooks: (() => Promise<void>)[];
  private signalHooks: { [signal: string]: (() => Promise<void>)[] };

  constructor() {
    this.preStopHooks = [];
    this.signalHooks = {};
  }

  public init(): void {
    this.trapSignal('SIGHUP');
    this.trapSignal('SIGINT', 0);
    this.trapSignal('SIGQUIT', 128 + 3);
    this.trapSignal('SIGABRT', 128 + 6);
    this.trapSignal('SIGTERM', 128 + 15);
    this.trapSignal('SIGUSR1', 128 + 11);
    this.trapSignal('SIGUSR2', 128 + 12);
  }

  private trapSignal(signal: NodeJS.Signals, exitCode?: number) {
    this.logger.info('Trapping signal', signal);
    process.on(signal, async () => {
      this.logger.info('Trapped signal', signal);
      let promises: Promise<void>[] = [];
      let shouldExit = exitCode !== undefined && exitCode !== null;
      if (shouldExit) {
        this.preStopHooks.forEach(hook => {
          promises.push(hook());
        });
      }
      if (this.signalHooks[signal]) {
        this.signalHooks[signal].forEach(hook => {
          promises.push(hook());
        });
      }
      await Promise.all(promises);
      if (shouldExit) {
        this.logger.info('exiting', exitCode);
        process.exit(exitCode);
      }
    });
  }

  public addPrestopHook(hook: () => Promise<void>) {
    this.preStopHooks.push(hook);
  }

  public addSignalHook(signal: string, hook: () => Promise<void>) {
    this.signalHooks[signal] = this.signalHooks[signal] || [];
    this.signalHooks[signal].push(hook);
  }
}
