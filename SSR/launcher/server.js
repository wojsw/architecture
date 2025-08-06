import express from 'express';
import { renderToString } from 'vue/server-renderer';
import { createAppManager } from './app.js';
import { httpPlugin } from '../plugins/http.js';

export class Launcher {
  constructor(options = {}) {
    this.server = express();

    this.server.use(express.static('.'));

    this.port = options.port || 3000;

    this.setupRoutes();
  }

  start() {
    this.server.set('port', this.port);

    this.server.listen(this.port, () => {
      console.log(`服务器已启动，访问 http://localhost:${this.port}`);
    });
  }

  setupRoutes() {
    this.server.get('/', async (req, res) => {
      try {
        // 每次请求创建新的应用管理器实例，避免状态污染
        const appManager = createAppManager();
        const app = appManager.createApp();

        appManager.addPlugin(httpPlugin, {
          baseUrl: `123`
        });
        appManager.registerPlugins();

        // 获取 HTTP 客户端和 SSR 数据存储
        const httpClient = app.config.globalProperties.$http;
        const ssrDataStore = app.config.globalProperties.$ssrData;

        // 渲染 Vue 应用
        const html = await renderToString(app);

        // 获取 SSR 数据用于注水
        const ssrData = {};

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
  }
}


