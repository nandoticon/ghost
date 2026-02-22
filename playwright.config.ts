import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: true,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        headless: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4174',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: true,
        timeout: 120_000,
    },
    projects: [
        {
            name: 'chromium-desktop',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium-iphone15',
            use: { ...devices['iPhone 15'], browserName: 'chromium' },
        },
    ],
})
