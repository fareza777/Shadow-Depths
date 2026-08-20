import { defineConfig } from 'vitest/config';
import { transformWithEsbuild } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'shadow-depths-classic-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.jsx')) return null;
      return transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsxFactory: 'h',
        jsxFragment: 'Fragment'
      });
    }
  }],
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    globals: false
  }
});
