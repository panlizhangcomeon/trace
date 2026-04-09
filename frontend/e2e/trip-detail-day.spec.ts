import { test, expect } from '@playwright/test';

const tripPayload = {
  id: 'trip-e2e',
  name: 'E2E 双日行程',
  destination: '测试目的地',
  start_date: '2026-04-03',
  routes: [
    {
      id: 'route-d1',
      trip: 'trip-e2e',
      name: 'Day 1',
      color: '#8b4513',
      day_number: 1,
      order_index: 0,
      pois: [
        {
          id: 'rp-d1-1',
          poi: {
            id: 'poi-sh',
            latitude: '31.2304',
            longitude: '121.4737',
            name: '上海标点E2E',
            type: 'attraction',
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          },
          order_index: 0,
          stop_note: null,
          segment_note: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'rp-d1-2',
          poi: {
            id: 'poi-sh2',
            latitude: '31.2404',
            longitude: '121.4837',
            name: '上海第二站',
            type: 'attraction',
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          },
          order_index: 1,
          stop_note: null,
          segment_note: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'route-d2',
      trip: 'trip-e2e',
      name: 'Day 2',
      color: '#8b4513',
      day_number: 2,
      order_index: 0,
      pois: [
        {
          id: 'rp-d2-1',
          poi: {
            id: 'poi-hs',
            latitude: '30.1377',
            longitude: '118.1616',
            name: '黄山标点E2E',
            type: 'attraction',
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          },
          order_index: 0,
          stop_note: null,
          segment_note: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/trips/trip-e2e/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tripPayload),
    });
  });
});

test('切换 Day 后地图上的标记数量与当日一致', async ({ page }) => {
  await page.goto('/trips/trip-e2e');

  await expect(page.getByRole('heading', { name: 'E2E 双日行程' })).toBeVisible({ timeout: 30_000 });

  await expect(page.locator('.maplibregl-marker')).toHaveCount(2, { timeout: 20_000 });

  await page.getByRole('button', { name: 'Day 2' }).click();
  await expect(page.locator('.maplibregl-marker')).toHaveCount(1, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Day 1' }).click();
  await expect(page.locator('.maplibregl-marker')).toHaveCount(2, { timeout: 15_000 });
});

test('有开始日期时，点日历次日切换到 Day 2', async ({ page }) => {
  await page.goto('/trips/trip-e2e');
  await expect(page.getByRole('heading', { name: 'E2E 双日行程' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('gridcell', { name: '4' }).first().click();
  await expect(page.getByText('Day 2 路线')).toBeVisible();
  await expect(page.locator('.maplibregl-marker')).toHaveCount(1, { timeout: 15_000 });
});

test('编辑路线模式下仍可打开路段备注弹窗', async ({ page }) => {
  await page.goto('/trips/trip-e2e');
  await expect(page.getByRole('heading', { name: 'E2E 双日行程' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '编辑路线' }).click();

  const map = page.locator('.maplibregl-canvas');
  await expect(map).toBeVisible({ timeout: 20_000 });
  const box = await map.boundingBox();
  if (!box) throw new Error('map canvas missing');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);

  await expect(page.getByRole('dialog').filter({ hasText: '路段' })).toBeVisible({ timeout: 10_000 });
});
