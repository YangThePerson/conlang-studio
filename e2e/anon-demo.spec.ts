import { test, expect } from '@playwright/test';

const demoLanguageId = process.env.NEXT_PUBLIC_DEMO_LANGUAGE_ID;

test.skip(
  !demoLanguageId,
  'NEXT_PUBLIC_DEMO_LANGUAGE_ID not set — no public demo language configured',
);

test('anonymous visitor can generate a word from the public demo language without signing in', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(new RegExp(`/languages/${demoLanguageId}$`));

  await page.goto(`/languages/${demoLanguageId}/wordgen`);
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('No words have been generated yet.')).toHaveCount(0);

  // canEdit hides the button entirely for anonymous visitors rather than
  // disabling it, so its absence is what confirms the ownership gate.
  await expect(page.getByTitle('Add to Dictionary')).toHaveCount(0);
});
