/**
 * HTTP 插件 - SSR 专用版本
 * 支持服务端数据预取、客户端状态同步、请求拦截等功能
 */

/**
 * HTTP 客户端类
 * 封装原生 fetch API，提供拦截器、错误处理、缓存等功能
 */
class HttpClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || '';
    this.timeout = options.timeout || 10000;
    this.headers = options.headers || {};
    
    // 拦截器
    this.interceptors = {
      request: [],
      response: []
    };
    
    // 缓存存储
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5分钟
    
    // 重试配置
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * 添加请求拦截器
   * @param {Function} fulfilled - 成功处理函数
   * @param {Function} rejected - 失败处理函数
   */
  addRequestInterceptor(fulfilled, rejected) {
    this.interceptors.request.push({ fulfilled, rejected });
  }

  /**
   * 添加响应拦截器
   * @param {Function} fulfilled - 成功处理函数
   * @param {Function} rejected - 失败处理函数
   */
  addResponseInterceptor(fulfilled, rejected) {
    this.interceptors.response.push({ fulfilled, rejected });
  }

  /**
   * 处理请求拦截器
   * @param {Object} config - 请求配置
   * @returns {Object} 处理后的配置
   */
  async processRequestInterceptors(config) {
    let processedConfig = { ...config };
    
    for (const interceptor of this.interceptors.request) {
      try {
        if (interceptor.fulfilled) {
          processedConfig = await interceptor.fulfilled(processedConfig);
        }
      } catch (error) {
        if (interceptor.rejected) {
          throw await interceptor.rejected(error);
        }
        throw error;
      }
    }
    
    return processedConfig;
  }

  /**
   * 处理响应拦截器
   * @param {Object} response - 响应对象
   * @returns {Object} 处理后的响应
   */
  async processResponseInterceptors(response) {
    let processedResponse = response;
    
    for (const interceptor of this.interceptors.response) {
      try {
        if (interceptor.fulfilled) {
          processedResponse = await interceptor.fulfilled(processedResponse);
        }
      } catch (error) {
        if (interceptor.rejected) {
          throw await interceptor.rejected(error);
        }
        throw error;
      }
    }
    
    return processedResponse;
  }

  /**
   * 生成缓存键
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {string} 缓存键
   */
  generateCacheKey(url, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * 检查缓存
   * @param {string} cacheKey - 缓存键
   * @returns {Object|null} 缓存的响应或null
   */
  getCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(cacheKey);
    return null;
  }

  /**
   * 设置缓存
   * @param {string} cacheKey - 缓存键
   * @param {Object} data - 要缓存的数据
   */
  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 带重试的请求方法
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @param {number} retryCount - 当前重试次数
   * @returns {Promise} 请求结果
   */
  async requestWithRetry(url, options, retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (retryCount < this.retryCount && this.shouldRetry(error)) {
        console.warn(`请求失败，${this.retryDelay}ms 后进行第 ${retryCount + 1} 次重试:`, error.message);
        await this.delay(this.retryDelay);
        return this.requestWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error) {
    // 网络错误或服务器错误时重试
    return error.name === 'AbortError' || 
           error.message.includes('fetch') ||
           error.message.includes('5');
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 通用请求方法
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise} 请求结果
   */
  async request(url, options = {}) {
    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    // 处理请求配置
    let config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...options.headers
      },
      ...options
    };

    // 应用请求拦截器
    config = await this.processRequestInterceptors(config);

    // 检查缓存（仅对 GET 请求）
    if (config.method === 'GET' && config.cache !== false) {
      const cacheKey = this.generateCacheKey(fullUrl, config);
      const cachedResponse = this.getCache(cacheKey);
      if (cachedResponse) {
        console.log('返回缓存数据:', fullUrl);
        return cachedResponse;
      }
    }

    try {
      // 发送请求
      const response = await this.requestWithRetry(fullUrl, config);
      
      // 解析响应
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const result = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config
      };

      // 应用响应拦截器
      const processedResult = await this.processResponseInterceptors(result);

      // 缓存 GET 请求的成功响应
      if (config.method === 'GET' && config.cache !== false) {
        const cacheKey = this.generateCacheKey(fullUrl, config);
        this.setCache(cacheKey, processedResult);
      }

      return processedResult;

    } catch (error) {
      // 处理响应拦截器中的错误
      try {
        await this.processResponseInterceptors(null);
      } catch (interceptorError) {
        throw interceptorError;
      }
      
      throw {
        message: error.message,
        status: error.status || 0,
        config,
        originalError: error
      };
    }
  }

  // 便捷方法
  get(url, config = {}) {
    return this.request(url, { ...config, method: 'GET' });
  }

  post(url, data, config = {}) {
    return this.request(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(url, data, config = {}) {
    return this.request(url, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(url, config = {}) {
    return this.request(url, { ...config, method: 'DELETE' });
  }
}

/**
 * SSR 数据存储类
 * 管理服务端预取的数据和客户端状态同步
 */
class SSRDataStore {
  constructor() {
    this.store = new Map();
    this.isServer = typeof window === 'undefined';
  }

  /**
   * 设置 SSR 数据
   * @param {string} key - 数据键
   * @param {any} data - 数据值
   */
  set(key, data) {
    this.store.set(key, data);
  }

  /**
   * 获取 SSR 数据
   * @param {string} key - 数据键
   * @returns {any} 数据值
   */
  get(key) {
    return this.store.get(key);
  }

  /**
   * 检查是否存在数据
   * @param {string} key - 数据键
   * @returns {boolean} 是否存在
   */
  has(key) {
    return this.store.has(key);
  }

  /**
   * 获取所有数据（用于数据注水）
   * @returns {Object} 所有数据
   */
  getState() {
    return Object.fromEntries(this.store);
  }

  /**
   * 从序列化状态恢复数据（用于数据脱水）
   * @param {Object} state - 序列化的状态
   */
  setState(state) {
    if (state && typeof state === 'object') {
      Object.entries(state).forEach(([key, value]) => {
        this.store.set(key, value);
      });
    }
  }

  /**
   * 清空所有数据
   */
  clear() {
    this.store.clear();
  }
}

// 创建全局实例
const ssrDataStore = new SSRDataStore();

/**
 * HTTP 插件主体
 */
export const httpPlugin = {
  name: 'HttpPlugin',
  priority: 1,
  
  install(app, options = {}) {
    // 创建 HTTP 客户端实例
    const httpClient = new HttpClient({
      baseURL: options.baseURL || '/api',
      timeout: options.timeout || 10000,
      headers: options.headers || {},
      ...options
    });

    // 添加默认拦截器
    this.setupDefaultInterceptors(httpClient, app);

    // 将 HTTP 客户端挂载到应用实例
    app.config.globalProperties.$http = httpClient;
    app.provide('$http', httpClient);

    // 将 SSR 数据存储挂载到应用实例
    app.config.globalProperties.$ssrData = ssrDataStore;
    app.provide('$ssrData', ssrDataStore);

    // 在服务端，将数据注入到全局对象中
    if (typeof window === 'undefined') {
      global.__SSR_DATA__ = ssrDataStore;
    } else {
      // 在客户端，从全局对象中恢复数据
      if (window.__SSR_DATA__) {
        ssrDataStore.setState(window.__SSR_DATA__);
      }
    }

    console.log('HTTP 插件已安装', {
      baseURL: httpClient.baseURL,
      isServer: typeof window === 'undefined'
    });
  },

  /**
   * 设置默认拦截器
   * @param {HttpClient} httpClient - HTTP 客户端实例
   * @param {Object} app - Vue 应用实例
   */
  setupDefaultInterceptors(httpClient, app) {
    // 请求拦截器 - 添加认证信息
    httpClient.addRequestInterceptor(
      (config) => {
        // 添加时间戳防止缓存
        if (config.method === 'GET' && config.timestamp !== false) {
          const url = new URL(config.url || '', config.baseURL || '');
          url.searchParams.set('_t', Date.now().toString());
          config.url = url.toString();
        }

        // 添加认证 token
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        console.log('发送请求:', config.method, config.url);
        return config;
      },
      (error) => {
        console.error('请求拦截器错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器 - 统一错误处理
    httpClient.addResponseInterceptor(
      (response) => {
        console.log('收到响应:', response.status, response.config?.url);
        return response;
      },
      (error) => {
        console.error('响应错误:', error.message);
        
        // 根据不同错误类型进行处理
        if (error.status === 401) {
          // 未授权，清除 token
          this.clearAuthToken();
          console.warn('用户未授权，请重新登录');
        } else if (error.status === 403) {
          console.warn('权限不足');
        } else if (error.status >= 500) {
          console.error('服务器错误');
        } else if (error.status === 0) {
          console.error('网络错误');
        }

        return Promise.reject(error);
      }
    );
  },

  /**
   * 获取认证 token
   * @returns {string|null} 认证 token
   */
  getAuthToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },

  /**
   * 清除认证 token
   */
  clearAuthToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }
};