import { AxiosRequestConfig } from 'axios';

declare module 'axios' {
  class AxiosRequestConfig {
    debugId?: number;
  }
}
