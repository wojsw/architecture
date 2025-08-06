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
      },

      template: `
        <div>Hello SSR</div>
      `
    });

    return this.app;
  }

  /**
   * 添加插件到插件队列
   * @param {Object} plugin - 要添加的插件对象，应包含 priority 属性
   */
  addPlugin(plugin, options = {}) {
    if (!plugin) {
      console.warn('插件不能为空');
      return;
    }
    
    // 检查插件是否已存在，避免重复添加
    const exists = this.plugins.some(p => p === plugin || p.name === plugin.name); 
    if (!exists) {
      this.plugins.push({ plugin, options });
    }
  }

  /**
   * 注册所有插件到 Vue 应用实例
   * 按照优先级排序后依次注册
   */
  registerPlugins() {
    // 按优先级排序并注册插件
    this.plugins
    .sort((a, b) => a.plugin?.priority - b.plugin?.priority)
    .forEach(({ plugin, options }) => {
      try {
        this.app.use(plugin, options);
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
