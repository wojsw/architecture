import { createSSRApp } from 'vue';

export function createApp() {
  const app = createSSRApp({
    data: () => ({ count: 1 }),
    template: `<div @click="count++">{{ count }}</div>`,
  });

  

  return app
}
