class HttpClient {
  constructor(options = {}) {
    this.options = options;

    // 请求基本信息
    this.baseUrl = options.baseUrl || '/api';
    this.headers = options.headers || {};

    // 超时机制
    this.timeout = options.timeout || 10000;
    this.retryCount = options.retryCount || 2;

    // 缓存
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3 * 60 * 1000;

    // 拦截函数集合
    this.interceptors = {
      request: [],
      response: []
    }

  }

  addResponseInterceptor(fulfilled, rejected) {
    this.interceptors.response.push({ fulfilled, rejected })
  }

  addRequestInterceptor(fulfilled, rejected) {
    this.interceptors.request.push({ fulfilled, rejected })
  }

  request(url, options = {}) {
    console.log('request', url, options)
  }

  get(url, config = {}) {
    return this.request(url, { ...config, method: 'GET' });
  }

  post(url, data, config = {}) {
    return this.request(url, { ...config, method: 'POST', body: JSON.stringify(data) });
  }
  
}

class SSRDataStore {
  constructor() {
    this.data = new Map();
  }

  set(key, value) {
    this.data.set(key, value);
  }

  get(key) {
    return this.data.get(key);
  }

  has(key) {
    return this.data.has(key);
  }

  getState() {
    return Object.fromEntries(this.data);
  }

  setState(state) {
    Object.entries(state).forEach(([key, value]) => {
      this.data.set(key, value);
    });
  }

  clear() {
    this.data.clear();
  }
}

export const httpPlugin = {
  name: 'http',
  priority: 1,
  install(app, options) {
    const httpClient = new HttpClient(options);
    const ssrDataStore = new SSRDataStore();

    httpClient.addResponseInterceptor(
      (response) => {
        console.log('response', response)
        return response
      },
      (error) => {
        console.log('error', error)
        return Promise.reject(error)
      }
    )

    httpClient.addRequestInterceptor(
      (config) => {
        console.log('config', config)
        return config
      },
      (error) => {
        console.log('error', error)
        return Promise.reject(error)
      }
    )

    app.config.globalProperties.$http = httpClient;
    app.provide('$http', httpClient);

    app.config.globalProperties.$ssrData = ssrDataStore;
    app.provide('$ssrData', ssrDataStore);
  }
}

