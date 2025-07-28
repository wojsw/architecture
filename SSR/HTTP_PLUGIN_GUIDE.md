# Vue SSR HTTP 插件使用指南

## 📝 概述

这是一个专为 Vue SSR 项目设计的 HTTP 插件，提供了完整的数据预取、状态同步、请求拦截等功能。

## 🚀 核心功能

### 1. HTTP 客户端功能
- ✅ 基于 Fetch API 的 HTTP 客户端
- ✅ 请求/响应拦截器
- ✅ 自动重试机制
- ✅ 智能缓存系统
- ✅ 超时控制
- ✅ 错误处理

### 2. SSR 专用功能
- ✅ 服务端数据预取
- ✅ 数据注水/脱水
- ✅ 状态同步
- ✅ 客户端 hydration

### 3. 认证和安全
- ✅ JWT Token 自动处理
- ✅ 请求头自动注入
- ✅ 统一错误处理

## 📦 安装和配置

### 基础用法

```javascript
import { createAppManager } from './app.js';
import { httpPlugin } from '../plugins/http.js';

// 创建应用管理器
const appManager = createAppManager();
const app = appManager.createApp();

// 添加 HTTP 插件
appManager.addPlugin(httpPlugin);
appManager.registerPlugins();
```

### 高级配置

```javascript
// 自定义配置选项
const httpOptions = {
  baseURL: '/api',              // 基础 URL
  timeout: 10000,               // 超时时间（毫秒）
  headers: {                    // 默认请求头
    'X-Client': 'Vue-SSR'
  },
  cacheTimeout: 5 * 60 * 1000,  // 缓存超时时间
  retryCount: 3,                // 重试次数
  retryDelay: 1000              // 重试延迟
};

// 使用配置创建插件实例
app.use(httpPlugin, httpOptions);
```

## 🔧 API 参考

### HTTP 客户端方法

```javascript
// 在组件中使用
import { inject } from 'vue';

export default {
  setup() {
    const $http = inject('$http');
    
    // GET 请求
    const userData = await $http.get('/user/123');
    
    // POST 请求
    const result = await $http.post('/users', {
      name: 'John',
      email: 'john@example.com'
    });
    
    // PUT 请求
    await $http.put('/user/123', updateData);
    
    // DELETE 请求
    await $http.delete('/user/123');
    
    // 自定义请求
    const response = await $http.request('/custom', {
      method: 'PATCH',
      headers: { 'Custom-Header': 'value' },
      cache: false  // 禁用缓存
    });
  }
}
```

### SSR 数据存储

```javascript
// 在组件中使用 SSR 数据存储
import { inject } from 'vue';

export default {
  setup() {
    const $ssrData = inject('$ssrData');
    
    // 设置数据
    $ssrData.set('user', userData);
    
    // 获取数据
    const user = $ssrData.get('user');
    
    // 检查数据是否存在
    if ($ssrData.has('posts')) {
      const posts = $ssrData.get('posts');
    }
    
    // 获取所有数据（用于序列化）
    const allData = $ssrData.getState();
    
    // 从序列化数据恢复
    $ssrData.setState(serverData);
  }
}
```

## 🔄 拦截器系统

### 请求拦截器

```javascript
// 添加请求拦截器
$http.addRequestInterceptor(
  (config) => {
    // 在发送请求前处理配置
    config.headers['Authorization'] = `Bearer ${getToken()}`;
    return config;
  },
  (error) => {
    // 处理请求错误
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);
```

### 响应拦截器

```javascript
// 添加响应拦截器
$http.addResponseInterceptor(
  (response) => {
    // 处理响应数据
    if (response.data.code !== 200) {
      throw new Error(response.data.message);
    }
    return response.data;
  },
  (error) => {
    // 处理响应错误
    if (error.status === 401) {
      // 重定向到登录页
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 💾 缓存策略

### 自动缓存

```javascript
// GET 请求默认启用缓存（5分钟）
const data = await $http.get('/api/data');

// 禁用缓存
const freshData = await $http.get('/api/data', { cache: false });

// 自定义缓存时间
const cachedData = await $http.get('/api/data', { 
  cacheTimeout: 10 * 60 * 1000  // 10分钟
});
```

### 手动缓存管理

```javascript
// 清除特定缓存
$http.cache.delete('GET:/api/data:');

// 清除所有缓存
$http.cache.clear();
```

## 🔄 重试机制

```javascript
// 默认重试配置（网络错误或服务器错误时自动重试）
const data = await $http.get('/api/data');  // 最多重试3次

// 自定义重试配置
const customHttp = new HttpClient({
  retryCount: 5,      // 重试5次
  retryDelay: 2000    // 每次重试间隔2秒
});
```

## 🌐 SSR 数据流

### 服务端数据预取

```javascript
// server.js
server.get('/', async (req, res) => {
  const appManager = createAppManager();
  const app = appManager.createApp();
  
  appManager.addPlugin(httpPlugin);
  appManager.registerPlugins();
  
  // 获取服务端实例
  const $http = app.config.globalProperties.$http;
  const $ssrData = app.config.globalProperties.$ssrData;
  
  // 预取数据
  const [userResponse, postsResponse] = await Promise.all([
    $http.get('/api/user'),
    $http.get('/api/posts')
  ]);
  
  // 存储到 SSR 数据中
  $ssrData.set('user', userResponse.data);
  $ssrData.set('posts', postsResponse.data);
  
  // 渲染应用
  const html = await renderToString(app);
  
  // 注水：将数据嵌入到 HTML 中
  const ssrData = $ssrData.getState();
  res.send(`
    <html>
      <head>
        <script>
          window.__SSR_DATA__ = ${JSON.stringify(ssrData)};
        </script>
      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
  `);
});
```

### 客户端数据恢复

```javascript
// 组件中自动恢复数据
export default {
  setup() {
    const $ssrData = inject('$ssrData');
    const user = ref(null);
    
    // 从 SSR 数据中恢复
    onMounted(() => {
      if ($ssrData.has('user')) {
        user.value = $ssrData.get('user');
      }
    });
    
    return { user };
  }
}
```

## 🛠️ 最佳实践

### 1. 错误处理

```javascript
// 组件级错误处理
async function fetchData() {
  try {
    loading.value = true;
    const response = await $http.get('/api/data');
    data.value = response.data;
  } catch (error) {
    // 显示用户友好的错误信息
    errorMessage.value = getErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

function getErrorMessage(error) {
  if (error.status === 0) return '网络连接错误';
  if (error.status === 401) return '请先登录';
  if (error.status === 403) return '权限不足';
  if (error.status >= 500) return '服务器错误';
  return error.message || '未知错误';
}
```

### 2. 加载状态管理

```javascript
// 统一的加载状态管理
const useLoading = () => {
  const loading = ref(false);
  
  const withLoading = async (asyncFn) => {
    try {
      loading.value = true;
      return await asyncFn();
    } finally {
      loading.value = false;
    }
  };
  
  return { loading, withLoading };
};

// 使用
const { loading, withLoading } = useLoading();

const fetchUser = () => withLoading(async () => {
  const response = await $http.get('/api/user');
  user.value = response.data;
});
```

### 3. 环境配置

```javascript
// 根据环境配置不同的选项
const getHttpConfig = () => {
  const baseConfig = {
    timeout: 10000,
    retryCount: 3
  };
  
  if (process.env.NODE_ENV === 'development') {
    return {
      ...baseConfig,
      baseURL: 'http://localhost:3001/api'
    };
  }
  
  return {
    ...baseConfig,
    baseURL: '/api'
  };
};
```

## 🐛 故障排除

### 常见问题

1. **数据未同步到客户端**
   - 检查 `window.__SSR_DATA__` 是否正确注入
   - 确认 SSR 数据存储的 `setState` 方法被调用

2. **请求超时**
   - 增加 `timeout` 配置
   - 检查网络连接

3. **缓存问题**
   - 使用 `cache: false` 禁用缓存
   - 清除浏览器缓存

4. **重试失败**
   - 检查 `shouldRetry` 方法的逻辑
   - 增加 `retryCount` 配置

## 📚 示例项目

查看 `SSR/launcher/` 目录下的完整示例，包含：
- 服务端数据预取
- 客户端状态恢复
- 错误处理
- 加载状态
- 缓存演示

运行示例：
```bash
cd SSR
node launcher/server.js
```

访问 http://localhost:3000 查看演示效果。 