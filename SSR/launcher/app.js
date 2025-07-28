import { createSSRApp, ref, onMounted, inject } from 'vue';

/**
 * Vue 应用实例管理类
 * 负责创建和管理 Vue 应用实例，提供插件注册功能
 * 每个实例都有独立的插件状态，避免全局状态污染
 */
class VueAppManager {
  constructor() {
    // 每个实例都有独立的插件数组，避免全局状态污染
    this.plugins = [];
    this.app = null;
  }

  /**
   * 创建 Vue SSR 应用实例
   * @returns {Object} Vue 应用实例
   */
  createApp() {
    if (this.app) {
      return this.app;
    }

    this.app = createSSRApp({
      setup() {
        // 注入 HTTP 客户端和 SSR 数据存储
        const $http = inject('$http');
        const $ssrData = inject('$ssrData');
        
        // 响应式数据
        const user = ref(null);
        const posts = ref([]);
        const loading = ref(false);
        const error = ref(null);
        const newPostTitle = ref('');
        const newPostContent = ref('');

        // 从 SSR 数据存储中恢复数据
        const initializeData = () => {
          if ($ssrData.has('user')) {
            user.value = $ssrData.get('user');
          }
          if ($ssrData.has('posts')) {
            posts.value = $ssrData.get('posts');
          }
        };

        // 获取用户信息
        const fetchUser = async () => {
          try {
            loading.value = true;
            error.value = null;
            
            const response = await $http.get('/api/user');
            user.value = response.data;
            
            // 更新 SSR 数据存储
            $ssrData.set('user', response.data);
            
          } catch (err) {
            error.value = `获取用户信息失败: ${err.message}`;
            console.error('获取用户信息失败:', err);
          } finally {
            loading.value = false;
          }
        };

        // 获取文章列表
        const fetchPosts = async () => {
          try {
            loading.value = true;
            error.value = null;
            
            const response = await $http.get('/api/posts');
            posts.value = response.data;
            
            // 更新 SSR 数据存储
            $ssrData.set('posts', response.data);
            
          } catch (err) {
            error.value = `获取文章列表失败: ${err.message}`;
            console.error('获取文章列表失败:', err);
          } finally {
            loading.value = false;
          }
        };

        // 创建新文章
        const createPost = async () => {
          if (!newPostTitle.value.trim() || !newPostContent.value.trim()) {
            error.value = '请填写文章标题和内容';
            return;
          }

          try {
            loading.value = true;
            error.value = null;

            const postData = {
              title: newPostTitle.value.trim(),
              content: newPostContent.value.trim()
            };

            // 模拟创建文章（实际项目中会调用 API）
            const newPost = {
              id: Date.now(),
              ...postData
            };

            posts.value.unshift(newPost);
            
            // 清空表单
            newPostTitle.value = '';
            newPostContent.value = '';
            
            console.log('文章创建成功:', newPost);

          } catch (err) {
            error.value = `创建文章失败: ${err.message}`;
            console.error('创建文章失败:', err);
          } finally {
            loading.value = false;
          }
        };

        // 刷新所有数据
        const refreshAll = async () => {
          await Promise.all([fetchUser(), fetchPosts()]);
        };

        // 清除错误
        const clearError = () => {
          error.value = null;
        };

        // 客户端挂载时初始化数据
        onMounted(() => {
          initializeData();
          console.log('客户端组件已挂载');
          console.log('用户数据:', user.value);
          console.log('文章数据:', posts.value);
        });

        // 在服务端立即初始化数据
        if (typeof window === 'undefined') {
          initializeData();
        }

        return {
          user,
          posts,
          loading,
          error,
          newPostTitle,
          newPostContent,
          fetchUser,
          fetchPosts,
          createPost,
          refreshAll,
          clearError
        };
      },

      template: `
        <div class="container">
          <h1>Vue SSR + HTTP 插件演示</h1>
          
          <!-- 错误提示 -->
          <div v-if="error" class="error">
            {{ error }}
            <button @click="clearError" style="margin-left: 10px;">清除错误</button>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="loading">
            正在加载数据...
          </div>

          <!-- 用户信息 -->
          <div class="user-info">
            <h2>用户信息</h2>
            <div v-if="user && user.data">
              <p><strong>姓名:</strong> {{ user.data.name }}</p>
              <p><strong>邮箱:</strong> {{ user.data.email }}</p>
              <p><strong>ID:</strong> {{ user.data.id }}</p>
            </div>
            <div v-else>
              <p class="loading">暂无用户信息</p>
            </div>
            <button @click="fetchUser" :disabled="loading">刷新用户信息</button>
          </div>

          <!-- 文章列表 -->
          <div>
            <h2>文章列表</h2>
            <div v-if="posts && posts.data && posts.data.length > 0">
              <div v-for="post in posts.data" :key="post.id" class="post">
                <h3>{{ post.title }}</h3>
                <p>{{ post.content }}</p>
                <small>文章 ID: {{ post.id }}</small>
              </div>
            </div>
            <div v-else>
              <p class="loading">暂无文章</p>
            </div>
            <button @click="fetchPosts" :disabled="loading">刷新文章列表</button>
          </div>

          <!-- 创建新文章 -->
          <div style="margin-top: 30px; background: #f5f5f5; padding: 20px; border-radius: 5px;">
            <h3>创建新文章</h3>
            <div style="margin-bottom: 10px;">
              <input 
                v-model="newPostTitle" 
                placeholder="文章标题" 
                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
              />
            </div>
            <div style="margin-bottom: 10px;">
              <textarea 
                v-model="newPostContent" 
                placeholder="文章内容" 
                rows="4"
                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
              ></textarea>
            </div>
            <button @click="createPost" :disabled="loading || !newPostTitle.trim() || !newPostContent.trim()">
              创建文章
            </button>
          </div>

          <!-- 操作按钮 -->
          <div style="margin-top: 20px;">
            <button @click="refreshAll" :disabled="loading">刷新所有数据</button>
            <button @click="() => { user = null; posts = []; }" :disabled="loading">清空数据</button>
          </div>

          <!-- 技术说明 -->
          <div style="margin-top: 30px; padding: 15px; background: #e8f5e8; border-radius: 5px; font-size: 14px;">
            <h4>技术特性演示：</h4>
            <ul>
              <li>🚀 <strong>SSR 数据预取：</strong>服务端预先获取用户和文章数据</li>
              <li>💧 <strong>数据注水脱水：</strong>服务端数据自动同步到客户端</li>
              <li>🔄 <strong>HTTP 拦截器：</strong>统一请求响应处理和错误处理</li>
              <li>⚡ <strong>智能缓存：</strong>GET 请求自动缓存 5 分钟</li>
              <li>🔁 <strong>自动重试：</strong>网络错误时自动重试 3 次</li>
              <li>🛡️ <strong>错误边界：</strong>优雅的错误处理和用户提示</li>
            </ul>
          </div>
        </div>
      `
    });

    return this.app;
  }

  /**
   * 添加插件到插件队列
   * @param {Object} plugin - 要添加的插件对象，应包含 priority 属性
   */
  addPlugin(plugin) {
    if (!plugin) {
      console.warn('插件不能为空');
      return;
    }
    
    // 检查插件是否已存在，避免重复添加
    const exists = this.plugins.some(p => p === plugin || p.name === plugin.name);
    if (!exists) {
      this.plugins.push(plugin);
    }
  }

  /**
   * 注册所有插件到 Vue 应用实例
   * 按照优先级排序后依次注册
   */
  registerPlugins() {
    if (!this.app) {
      console.error('应用实例尚未创建，请先调用 createApp()');
      return;
    }

    console.log('注册插件:', this.plugins.map(p => p.name || 'unnamed'));
    
    // 按优先级排序并注册插件
    this.plugins
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .forEach(plugin => {
        try {
          this.app.use(plugin);
        } catch (error) {
          console.error(`插件注册失败:`, plugin.name || 'unnamed', error);
        }
      });
  }

  /**
   * 获取当前应用实例
   * @returns {Object|null} Vue 应用实例
   */
  getApp() {
    return this.app;
  }

  /**
   * 销毁应用实例和相关状态
   */
  destroy() {
    this.plugins = [];
    this.app = null;
  }
}

/**
 * 工厂函数：创建新的 Vue 应用管理器实例
 * @returns {VueAppManager} 新的应用管理器实例
 */
export function createAppManager() {
  return new VueAppManager();
}

/**
 * 兼容性函数：保持原有 API 的向后兼容
 * 注意：此函数创建的实例仍会有共享状态问题，建议使用 createAppManager
 * @deprecated 推荐使用 createAppManager 替代
 */
export function createApp() {
  const manager = new VueAppManager();
  const app = manager.createApp();
  
  // 为了向后兼容，在 app 上添加方法
  app.addPluging = (plugin) => manager.addPlugin(plugin);
  app.registerPlugin = () => manager.registerPlugins();
  
  return app;
}
