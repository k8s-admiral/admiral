import { PropertyLoader, PropertySource } from '@fromnibly/config';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { LOG } from '../util/logger';

const logger = LOG('AnyYAMLFileLoader');

export class AnyYAMLFileLoader implements PropertyLoader {
  private yamlFileMatch = /ya?ml$/;
  constructor(private directory: string) {}

  // Ignore profiles since admiral doesn't have this concept
  async loadProperties(profiles: string[]): Promise<import('@fromnibly/config').PropertySource[]> {
    return (await Promise.all(
      (await fs.readdir(this.directory))
        .filter(file => file.match(/.ya?ml$/))
        .map(file => path.join(this.directory, file))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
        .map(async file => {
          if ((await fs.stat(file)).isDirectory()) {
            return null;
          }

          const source = new PropertySource(`File:${file}`);

          //load yaml into json object
          const content = await fs.readFile(file, { encoding: 'utf-8' });
          const props = yaml.load(content);

          // Set all properties in file
          // TODO: add metadata about the ref it was taken from
          source.setProperty('', props, { root: this.directory });

          return source;
        })
    )).filter(x => x) as PropertySource[]; // ts can't understand that filtering on truthiness results in a new type
  }
}
