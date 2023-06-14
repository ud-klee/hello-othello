import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default [
  {
    input: 'src/worker.js',
    output: [
      {
        file: 'dist/worker.min.js',
        format: 'iife',
        sourcemap: true,
        plugins: [terser()],
        globals: {
          tf: 'globalThis.tf',
        },
      },
    ],
    plugins: [
      nodeResolve(),
      nodePolyfills(),
    ],
  },
  {
    input: 'src/app.js',
    output: [
      {
        file: 'dist/app.min.js',
        format: 'iife',
        name: 'othello',
        sourcemap: true,
        plugins: [terser()],
        globals: {
          tf: 'globalThis.tf',
        },
      },
    ],
    plugins: [
      nodeResolve(),
      nodePolyfills(),
    ],
  },
  {
    input: 'src/replay.js',
    output: [
      {
        file: 'dist/replay.min.js',
        format: 'iife',
        sourcemap: true,
        plugins: [terser()],
        globals: {
          tf: 'globalThis.tf',
        },
      },
    ],
    plugins: [
      nodeResolve(),
      nodePolyfills(),
    ],
  },
];
