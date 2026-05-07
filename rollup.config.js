import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import css from 'rollup-plugin-css-only';
import svelte from 'rollup-plugin-svelte';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';

const mode = process.env.NODE_ENV;
const production = mode === 'production';

// 关键：配置 postcss 让 Tailwind 处理 @apply 指令
const preprocess = sveltePreprocess({
    postcss: {
        plugins: [
            require('postcss-import'),
            require('tailwindcss'),
            require('autoprefixer'),
        ],
    },
});

export default {
    input: 'src/main.js',
    output: {
        file: 'dist/bundle.js',
        sourcemap: !production,
        name: 'app',
        format: 'iife',
    },
    plugins: [
        copy({
            targets: [
                { src: 'src/template.html', dest: 'dist', rename: 'index.html' },
                { src: 'static/**/*', dest: 'dist' },
            ],
        }),

        svelte({
            compilerOptions: {
                dev: !production,
            },
            preprocess,
            emitCss: true,
        }),

        css({ output: 'bundle.css' }),

        resolve({
            browser: true,
            dedupe: ['svelte'],
        }),
        commonjs(),

        !production && serve(),
        !production && require('rollup-plugin-livereload')({
            watch: ['dist/bundle.js'],
        }),

        production && terser(),
    ],
    watch: {
        clearScreen: false,
    },
};

function serve() {
    let server;
    function toExit() {
        if (server) server.kill(0);
    }
    return {
        writeBundle() {
            if (server) return;
            server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
                stdio: ['ignore', 'inherit', 'inherit'],
                shell: true,
            });
            process.on('SIGTERM', toExit);
            process.on('exit', toExit);
        },
    };
}
