import express from 'express';
import { renderToString } from 'vue/server-renderer';
import { createAppManager } from './app.js';
import { httpPlugin } from '../plugins/http.js';

const server = express();

// 模拟 API 数据
const mockApiData = {
  user: { id: 1, name: '张三', email: 'zhangsan@example.com' },
  posts: [
    { id: 1, title: '文章1', content: '这是第一篇文章的内容' },
    { id: 2, title: '文章2', content: '这是第二篇文章的内容' }
  ]
};

// 模拟 API 接口
server.get('/api/user', (req, res) => {
  setTimeout(() => {
    res.json({ success: true, data: mockApiData.user });
  }, 100);
});

server.get('/api/posts', (req, res) => {
  setTimeout(() => {
    res.json({ success: true, data: mockApiData.posts });
  }, 150);
});

server.get('/', async (req, res) => {
  try {
    // 每次请求创建新的应用管理器实例，避免状态污染
    const appManager = createAppManager();
    const app = appManager.createApp();

    // 添加插件到当前请求的应用实例
    appManager.addPlugin(httpPlugin);
    appManager.registerPlugins();

    // 获取 HTTP 客户端和 SSR 数据存储
    const httpClient = app.config.globalProperties.$http;
    const ssrDataStore = app.config.globalProperties.$ssrData;

    // 服务端数据预取
    console.log('开始服务端数据预取...');
    
    try {
      // 配置 HTTP 客户端基础 URL（服务端请求自己的 API）
      httpClient.baseURL = `http://localhost:${server.get('port') || 3000}`;
      
      // 并发获取用户信息和文章列表
      const [userResponse, postsResponse] = await Promise.all([
        httpClient.get('/api/user'),
        httpClient.get('/api/posts')
      ]);

      // 将预取的数据存储到 SSR 数据存储中
      ssrDataStore.set('user', userResponse.data);
      ssrDataStore.set('posts', postsResponse.data);

      console.log('服务端数据预取完成:', {
        user: userResponse.data,
        posts: postsResponse.data
      });

    } catch (error) {
      console.error('服务端数据预取失败:', error.message);
      // 即使数据预取失败，也继续渲染页面
      ssrDataStore.set('user', null);
      ssrDataStore.set('posts', []);
    }

    // 渲染 Vue 应用
    const html = await renderToString(app);
    
    // 获取 SSR 数据用于注水
    const ssrData = ssrDataStore.getState();

    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vue SSR Example - HTTP 插件演示</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script type="importmap">
          {
            "imports": {
              "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
            }
          }
        </script>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .user-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .post { background: #f9f9f9; padding: 15px; margin-bottom: 10px; border-left: 4px solid #2196f3; }
          .loading { color: #666; font-style: italic; }
          .error { color: #f44336; background: #ffebee; padding: 10px; border-radius: 4px; }
          h1, h2 { color: #333; }
          button { background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
          button:hover { background: #1976d2; }
        </style>
        <script>
          // 将 SSR 数据注入到客户端
          window.__SSR_DATA__ = ${JSON.stringify(ssrData)};
        </script>
        <script type="module" src="/launcher/client.js"></script>
      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
    `);
    
    // 请求处理完成后清理资源
    appManager.destroy();

  } catch (error) {
    console.error('SSR 渲染失败:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>服务器错误</h1>
          <p>渲染页面时发生错误: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

server.use(express.static('.'));

const port = 3000;
server.set('port', port);

server.listen(port, () => {
  console.log(`服务器已启动，访问 http://localhost:${port}`);
  console.log('API 接口:');
  console.log(`  GET http://localhost:${port}/api/user`);
  console.log(`  GET http://localhost:${port}/api/posts`);
});
