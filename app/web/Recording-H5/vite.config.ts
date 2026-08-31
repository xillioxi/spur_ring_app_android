import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = 'https://34d5-240e-390-aa3-5a90-d43e-2916-d6ae-a786.ngrok-free.app';
const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  }
});
