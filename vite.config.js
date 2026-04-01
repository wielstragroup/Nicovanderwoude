import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index:     resolve(__dirname, 'index.html'),
        blog:      resolve(__dirname, 'blog.html'),
        contact:   resolve(__dirname, 'contact.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
});
