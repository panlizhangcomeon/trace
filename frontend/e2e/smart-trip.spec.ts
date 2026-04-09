import { test, expect } from '@playwright/test';

const draft = {
  schema_version: '1' as const,
  trip_summary: { title_hint: 'E2E 行程', destination_summary: '杭州' },
  origin: { label: '家' },
  days: [
    {
      day_index: 1,
      city_context: '杭州',
      stops: [{ display_name: '西湖', duration_minutes: 60 }],
    },
  ],
};

const tripId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test.describe('智能创建行程', () => {
  test('列表入口 → 填写 → 预览 → 确认 → TripDetail', async ({ page }) => {
    await page.route('**/api/v1/trips/ai-draft/**', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draft }),
      });
    });

    await page.route('**/api/v1/trips/ai-commit/**', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          trip: {
            id: tripId,
            name: 'E2E 行程',
            destination: '杭州',
            start_date: null,
            routes: [],
            created_at: '2026-04-07T00:00:00Z',
          },
          warnings: [],
        }),
      });
    });

    await page.goto('/trips');
    await page.getByRole('button', { name: '智能创建行程' }).click();
    await expect(page).toHaveURL('/trips/smart-create');

    await page.getByRole('textbox').fill('杭州一日游，看看西湖');
    await page.getByRole('button', { name: '生成行程草案' }).click();

    await expect(page.getByRole('button', { name: '确认创建行程' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '确认创建行程' }).click();

    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}`));
  });
});
