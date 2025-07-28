import { createAppManager } from './app.js';
import { httpPlugin } from '../plugins/http.js';

// 客户端创建应用管理器实例
const appManager = createAppManager();
const app = appManager.createApp();

// 添加 HTTP 插件，配置客户端特有的选项
appManager.addPlugin(httpPlugin);

// 客户端可以在这里添加客户端特有的插件配置
// 例如：设置不同的基础 URL、超时时间等
const httpOptions = {
  baseURL: '/api',
  timeout: 8000,
  headers: {
    'X-Client': 'Vue-SSR'
  },
  cacheTimeout: 3 * 60 * 1000, // 客户端缓存时间设置为 3 分钟
  retryCount: 2  // 客户端重试次数设置为 2 次
};

// 注册插件
appManager.registerPlugins();

console.log(appManager);

// 挂载应用到 DOM
app.mount('#app');
