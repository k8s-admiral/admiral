import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as https from 'https';
import { interfaces } from 'inversify';
import { Logger } from 'pino';
import { LOG } from '../util/logger';

type AxiosRequestConfigSansBaseUrl = Omit<AxiosRequestConfig, 'baseURL'>;

export type HTTPClientFactoryMethod = (
  name: string,
  baseURL: string,
  options?: AxiosRequestConfigSansBaseUrl
) => AxiosInstance;

export class HTTPClientFactory {
  static createClient(context: interfaces.Context): HTTPClientFactoryMethod {
    return (name: string, baseURL: string, options?: AxiosRequestConfigSansBaseUrl) => {
      const logger = HTTPClientFactory.createSerializingLogger(name);
      //TODO: make this configurable
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      const client = axios.create({
        baseURL,
        httpsAgent,
        ...(options || {}),
      });
      HTTPClientFactory.instrumentLogging(client, logger);
      return client;
    };
  }

  private static createSerializingLogger(name: string) {
    return LOG('HTTP:' + name, {
      serializers: {
        request: HTTPClientFactory.serializeRequest,
        response: HTTPClientFactory.serializeResponse,
        err: HTTPClientFactory.serializeError,
      },
    });
  }

  private static instrumentLogging(client: AxiosInstance, log: Logger) {
    let debugId = 0;

    client.interceptors.request.use(
      (request: AxiosRequestConfig) => {
        request.debugId = debugId++;
        log.debug({ request }, 'Client Request');
        return request;
      },
      (err: any) => {
        log.error({ err }, 'Client Request Error');
        throw err;
      }
    );

    client.interceptors.response.use(
      (response: AxiosResponse) => {
        log.debug({ response }, 'Client Response');
        return response;
      },
      (err: any) => {
        log.error({ err }, 'Client Response Error');
        throw err;
      }
    );
  }

  private static serializeRequest(request: AxiosRequestConfig) {
    console.log('serializing request');
    if (!request) {
      return {};
    }
    return {
      url: request.url,
      headers: request.headers,
      query: request.params,
      debugId: request.debugId,
      method: request.method,
    };
  }

  private static serializeResponse(response: AxiosResponse) {
    console.log('serializing response');
    if (!response) {
      return {};
    }
    return {
      bodyTrunc: JSON.stringify(response.data || {}).slice(0, 200),
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
      debugId: response.config.debugId,
    };
  }

  private static serializeError(error: any) {
    let axErr = error;

    while (!axErr || !axErr.hasOwnProperty('isAxiosError')) {
      axErr = axErr.nested;
    }

    const rtn: any = {
      err: error.stack,
    };

    if (axErr) {
      if (axErr.config) {
        rtn.request = HTTPClientFactory.serializeRequest(axErr.config);
      }
      if (axErr.response) {
        rtn.response = HTTPClientFactory.serializeResponse(axErr.response);
      }
    }

    return rtn;
  }
}
