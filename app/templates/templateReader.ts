import { PropertyDatabase } from '@fromnibly/config';
import * as fs from 'fs-extra';
import { compile } from 'handlebars';
import { injectable } from 'inversify';
import * as path from 'path';
import { VariableMap } from './models';

export type TemplateResolver = (vars: VariableMap) => string;

@injectable()
export class TemplateReader {
  private readonly templateRoot: string;

  constructor(private config: PropertyDatabase) {
    //TODO: create a git facade to load files instead of plopping this logic all over
    this.templateRoot = path.join(path.resolve(config.get('git.path').asString()), 'templates');
  }

  async readTemplate(templatePath: string): Promise<TemplateResolver> {
    let templateURL: URL;
    if (!templatePath.includes('://')) {
      templateURL = new URL('file://' + path.join(this.templateRoot, templatePath));
    } else {
      templateURL = new URL(templatePath);
    }

    let templateContent;
    //TODO: respect ref in URL
    switch (templateURL.protocol) {
      case 'https:':
        throw new Error('https not implemented');
        break;
      case 'file:':
        templateContent = await fs.readFile(templateURL.pathname, { encoding: 'utf-8' });
        break;
      case 'admiral:':
        templateContent = await fs.readFile(
          path.join(this.config.get('config.dir').asString(), templateURL.pathname),
          { encoding: 'utf-8' }
        );
      case 'ssh+git:':
        throw new Error('ssh+git not implemented');
        break;
      default:
        throw new Error(`Unsupported URI Scheme ${templateURL.protocol}`);
    }

    if (templateURL.pathname.match(/.hbs.ya?ml$/)) {
      const template = compile(templateContent);
      return (vars: VariableMap) => template(vars);
    } else {
      throw new Error(
        `Unable to load templates other than handlebars templates was ${templatePath}`
      );
    }
  }
}
