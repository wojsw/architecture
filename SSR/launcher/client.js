import { createAppManager } from './app.js';
import { httpPlugin } from '../plugins/http.js';

// 客户端创建应用管理器实例
const appManager = createAppManager();
const app = appManager.createApp();

// 添加 HTTP 插件，配置客户端特有的选项
appManager.addPlugin(httpPlugin);

// 注册插件
appManager.registerPlugins();

console.log('客户端app实例', appManager);

// 挂载应用到 DOM
app.mount('#app');
