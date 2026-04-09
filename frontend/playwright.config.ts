import { defineConfig, devices } from '@playwright/test';

/**
 * 避免 `playwright install` 从 CDN 拉浏览器（国内常很慢）：
 * 1) 默认用本机已安装的 Google Chrome（macOS：`/Applications/Google Chrome.app`）
 * 2) 若你手动下载了 Chrome for Testing 的 zip，先解压，再设置：
 *    export PLAYWRIGHT_CHROME_EXECUTABLE_PATH="/path/to/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
 *
 * 示例（zip 在 ~/Downloads）：
 *   unzip -q ~/Downloads/chrome-mac-arm64.zip -d ~/Downloads/chrome-cft
 *   export PLAYWRIGHT_CHROME_EXECUTABLE_PATH="$HOME/Downloads/chrome-cft/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
 */
const chromeExecutable = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH?.trim();

const chromiumUse = chromeExecutable
  ? { ...devices['Desktop Chrome'], executablePath: chromeExecutable }
  : { ...devices['Desktop Chrome'], channel: 'chrome' as const };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: chromiumUse }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
