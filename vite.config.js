import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // When the frontend (served by Vite) makes a request to '/socket.io',
      // Vite's dev server will proxy it to 'http://localhost:8000/socket.io'.
      '/socket.io': {
        target: 'http://localhost:8000', // Your backend server address
        ws: true,                         // Enable WebSocket proxying
        changeOrigin: true,               // Important for proper proxying
      }
    }
  }
})