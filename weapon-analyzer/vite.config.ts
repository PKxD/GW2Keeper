import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';
import tsconfigPaths from 'vite-tsconfig-paths'


// https://vitejs.dev/config/
export default defineConfig({
    plugins: [preact(), tsconfigPaths()],
    base: "/GW2Keeper",
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './test/setup.ts'
    }
});
