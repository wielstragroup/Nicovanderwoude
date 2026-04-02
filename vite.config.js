import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        index:     resolve(__dirname, 'index.html'),
        blog:      resolve(__dirname, 'blog.html'),
        contact:   resolve(__dirname, 'contact.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) {
            if (id.includes('/auth'))      return 'firebase-auth';
            if (id.includes('/firestore')) return 'firebase-firestore';
            if (id.includes('/storage'))   return 'firebase-storage';
            return 'firebase-core';
          }
          if (id.includes('node_modules/quill')) return 'quill';
        },
      },
    },
  },
});
