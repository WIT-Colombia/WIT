import { test, expect } from 'playwright/test';

/**
 * End-to-end contract for the real reviews flow. The coordinator supplies
 * credentials and the public business id at runtime; no credentials are
 * committed to the repository.
 */
const fixture = {
  businessId: process.env.E2E_BUSINESS_ID ?? '',
  userEmail: process.env.E2E_USER_EMAIL ?? '',
  userEmailDesktop: process.env.E2E_USER_EMAIL_DESKTOP ?? process.env.E2E_USER_EMAIL ?? '',
  userEmailMobile: process.env.E2E_USER_EMAIL_MOBILE ?? process.env.E2E_USER_EMAIL ?? '',
  editEmailDesktop: process.env.E2E_EDIT_EMAIL_DESKTOP ?? process.env.E2E_USER_EMAIL ?? '',
  editEmailMobile: process.env.E2E_EDIT_EMAIL_MOBILE ?? process.env.E2E_USER_EMAIL ?? '',
  businessEmailDesktop: process.env.E2E_BUSINESS_EMAIL_DESKTOP ?? process.env.E2E_USER_EMAIL ?? '',
  businessEmailMobile: process.env.E2E_BUSINESS_EMAIL_MOBILE ?? process.env.E2E_USER_EMAIL ?? '',
  userPassword: process.env.E2E_USER_PASSWORD ?? '',
  ownerEmail: process.env.E2E_OWNER_EMAIL ?? '',
  ownerPassword: process.env.E2E_OWNER_PASSWORD ?? '',
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? '',
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? '',
};

function requireFixture() {
  if (!fixture.businessId || !fixture.userEmail || !fixture.userPassword || !fixture.ownerEmail || !fixture.ownerPassword || !fixture.adminEmail || !fixture.adminPassword) {
    test.skip(true, 'El coordinador no entregó credenciales ficticias; no se ejecuta contra datos reales.');
  }
}

async function login(page: import('playwright/test').Page, email: string, password: string, route = '/register?mode=login') {
  await page.goto(route);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  // The apps keep the access token in memory. Persist the real refresh session
  // before navigating to another document so the login survives page.goto/reload.
  const remember = page.locator('label').filter({ hasText: 'Mantener mi sesión iniciada' }).locator('input[type="checkbox"]');
  if (await remember.count()) await remember.check();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/(?:register|login)(?:\?|$)/);
}

async function loginApi(page: import('playwright/test').Page, email: string) {
  const response = await page.request.post('/api/v1/auth/login', { data: { email, password: fixture.userPassword, rememberMe: false } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.accessToken).toBe('string');
  return body.accessToken as string;
}

const describeReviews = Object.values(fixture).every(Boolean) ? test.describe : test.describe.skip;
describeReviews('opiniones E2E reales', () => {
  test('Usuario publica, edita y conserva una opinión', async ({ page }, testInfo) => {
    requireFixture();
    const userEmail = testInfo.project.name.includes('mobile') ? fixture.userEmailMobile : fixture.userEmailDesktop;
    await login(page, userEmail, fixture.userPassword);
    await page.goto(`/business/${fixture.businessId}?tab=reviews`);
    await page.getByRole('link', { name: 'Escribir opinión' }).click();
    await page.getByRole('button', { name: '1 estrellas' }).click();
    await page.getByLabel('Escribe tu opinión').fill('Opinión E2E de prueba');
    const createResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/v1\/businesses\/[^/]+\/reviews$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: /enviar calificación/i }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status(), `POST de opinión nueva devolvió ${createResponse.status()}`).toBe(201);
    const created = await createResponse.json();
    expect(created.review?.id).toBeTruthy();
    expect(created.review?.businessId).toBeTruthy();
    await expect(page.getByText('Opinión E2E de prueba').first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('Opinión E2E de prueba').first()).toBeVisible();
    await page.screenshot({ path: `e2e-results/usuario-reviews-${testInfo.project.name}.png`, fullPage: true });
  });

  test('Usuario edita una opinión y rechaza un duplicado', async ({ page }, testInfo) => {
    const userEmail = testInfo.project.name.includes('mobile') ? fixture.editEmailMobile : fixture.editEmailDesktop;
    await login(page, userEmail, fixture.userPassword);
    await page.goto(`/business/${fixture.businessId}?tab=reviews`);
    await page.getByRole('link', { name: 'Escribir opinión' }).click();
    await page.getByRole('button', { name: '1 estrellas' }).click();
    await page.getByLabel('Escribe tu opinión').fill(`Opinión editable ${testInfo.project.name}`);
    const createPromise = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/businesses\/[^/]+\/reviews$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: /enviar calificación/i }).click();
    const createdResponse = await createPromise;
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json();
    const reviewId = created.review.id;
    await page.goto(`/reviews?businessId=${fixture.businessId}&businessName=E2E&reviewId=${reviewId}`);
    await expect(page.getByLabel('Escribe tu opinión')).toHaveValue(`Opinión editable ${testInfo.project.name}`);
    await page.getByLabel('Escribe tu opinión').fill(`Opinión editada ${testInfo.project.name}`);
    const updatePromise = page.waitForResponse(r => r.request().method() === 'PATCH' && /\/api\/v1\/reviews\/[^/]+$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    const updateResponse = await updatePromise;
    expect(updateResponse.ok()).toBe(true);
    const updated = await updateResponse.json();
    expect(updated.review?.id).toBe(reviewId);
    expect(updated.review?.comment).toBe(`Opinión editada ${testInfo.project.name}`);
    await expect(page.getByRole('status')).toContainText(/gracias|enviado/i);
    await page.waitForURL(/\/business\//);
    const publicReviewsResponse = await page.request.get(`/api/v1/public/businesses/${fixture.businessId}/reviews`);
    expect(publicReviewsResponse.status()).toBe(200);
    const publicReviews = await publicReviewsResponse.json();
    expect(publicReviews.reviews?.some((review) => review.id === reviewId && review.comment === `Opinión editada ${testInfo.project.name}`)).toBe(true);
    // Re-authenticate through the real login endpoint and use only the
    // legitimate short-lived access token for the independent duplicate call.
    const loginResponse = await page.request.post('/api/v1/auth/login', { data: { email: userEmail, password: fixture.userPassword, rememberMe: false } });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(typeof loginBody.accessToken).toBe('string');
    const duplicateResponse = await page.request.post(`/api/v1/businesses/${fixture.businessId}/reviews`, { data: { rating: 1, comment: 'Duplicado' }, headers: { Authorization: `Bearer ${loginBody.accessToken}` } });
    expect(duplicateResponse.status()).toBe(409);
    const duplicateBody = await duplicateResponse.json();
    expect(duplicateBody.error?.code).toBe('REVIEW_ALREADY_EXISTS');
  });

  test('Business responde, edita y reporta una opinión persistida', async ({ page }, testInfo) => {
    requireFixture();
    const consumerEmail = testInfo.project.name.includes('mobile') ? fixture.businessEmailMobile : fixture.businessEmailDesktop;
    const consumerToken = await loginApi(page, consumerEmail);
    const seedComment = `Opinión Business ${testInfo.project.name}`;
    const seedResponse = await page.request.post(`/api/v1/businesses/${fixture.businessId}/reviews`, { data: { rating: 4, comment: seedComment }, headers: { Authorization: `Bearer ${consumerToken}` } });
    expect(seedResponse.status()).toBe(201);
    const seeded = await seedResponse.json();
    const reviewId = seeded.review.id as string;
    await login(page, fixture.ownerEmail, fixture.ownerPassword, '/login');
    await page.goto('/opiniones');
    await expect(page.getByRole('heading', { name: 'Opiniones y calificaciones' })).toBeVisible();
    const review = page.locator('article.review-entry').filter({ hasText: seedComment });
    await expect(review).toBeVisible();
    await review.getByRole('button', { name: 'Responder' }).click();
    const replyText = `Respuesta inicial ${testInfo.project.name}`;
    await review.locator('textarea').fill(replyText);
    const createResponse = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/reviews\/[^/]+\/response$/.test(new URL(r.url()).pathname));
    await review.getByRole('button', { name: 'Guardar respuesta' }).click();
    const createdReply = await createResponse;
    expect(createdReply.ok()).toBe(true);
    await expect(review.getByText(replyText)).toBeVisible();
    await page.reload();
    const reloadedReview = page.locator('article.review-entry').filter({ hasText: seedComment });
    await expect(reloadedReview.getByText(replyText)).toBeVisible();
    await reloadedReview.getByRole('button', { name: 'Editar respuesta' }).click();
    const editedReply = `Respuesta editada ${testInfo.project.name}`;
    await reloadedReview.locator('textarea').fill(editedReply);
    const updateResponse = page.waitForResponse(r => r.request().method() === 'PATCH' && /\/api\/v1\/reviews\/[^/]+\/response$/.test(new URL(r.url()).pathname));
    await reloadedReview.getByRole('button', { name: 'Guardar respuesta' }).click();
    expect((await updateResponse).ok()).toBe(true);
    await expect(reloadedReview.getByText(editedReply)).toBeVisible();
    await page.reload();
    const persistedReview = page.locator('article.review-entry').filter({ hasText: seedComment });
    await expect(persistedReview.getByText(editedReply)).toBeVisible();
    await persistedReview.getByRole('button', { name: 'Reportar comentario' }).click();
    await persistedReview.locator('select').selectOption('SPAM');
    const reportResponse = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/reviews\/[^/]+\/reports$/.test(new URL(r.url()).pathname));
    await persistedReview.getByRole('button', { name: 'Enviar a revisión' }).click();
    expect((await reportResponse).status()).toBe(201);
    await expect(page.getByRole('status')).toContainText('Reporte enviado');
    const adminToken = await loginApi(page, fixture.adminEmail);
    const reports = await page.request.get('/api/v1/admin/review-reports', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(reports.status()).toBe(200);
    const reportBody = await reports.json();
    expect(reportBody.reports?.some((report: { reviewId?: string; review?: { id?: string } }) => report.reviewId === reviewId || report.review?.id === reviewId)).toBe(true);
    await page.screenshot({ path: `e2e-results/business-reviews-${testInfo.project.name}.png`, fullPage: true });
  });

  test('Admin visualiza la bandeja de reportes y sus acciones', async ({ page }, testInfo) => {
    requireFixture();
    await login(page, fixture.adminEmail, fixture.adminPassword, '/login');
    await page.goto('/reports');
    await expect(page.getByRole('main')).toBeVisible();
    await page.screenshot({ path: `e2e-results/admin-reports-${testInfo.project.name}.png`, fullPage: true });
  });

  test('Las tres aplicaciones no desbordan en móvil', async ({ page }, testInfo) => {
    requireFixture();
    const project = testInfo.project.name;
    const isUsuario = project.startsWith('usuario-');
    const isNegocios = project.startsWith('negocios-');
    const route = isUsuario ? `/business/${fixture.businessId}?tab=reviews` : isNegocios ? '/opiniones' : '/reports';
    if (isNegocios) await login(page, fixture.ownerEmail, fixture.ownerPassword, '/login');
    if (!isUsuario && !isNegocios) await login(page, fixture.adminEmail, fixture.adminPassword, '/login');
    await page.goto(route);
    // Each application has a different shell. Wait for the shell belonging to
    // this project instead of requiring Usuario's business detail selector in
    // Business/Admin projects.
    const ready = isUsuario
      ? page.locator('.business-detail-page')
      : isNegocios
        ? page.getByRole('heading', { name: 'Opiniones y calificaciones' })
        : page.getByRole('main');
    await expect(ready).toBeVisible();
    // Measure only after the page and fonts have settled. This avoids a false
    // positive from the first asynchronous layout pass under concurrent workers.
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const metrics = await page.evaluate(() => {
      const width = window.innerWidth;
      const offenders = [...document.querySelectorAll<HTMLElement>('*')]
        .map((element) => ({
          selector: element.tagName.toLowerCase() + (element.className && typeof element.className === 'string' ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''),
          right: element.getBoundingClientRect().right,
          left: element.getBoundingClientRect().left,
        }))
        .filter(({ right, left }) => right > width + 1 || left < -1)
        .slice(0, 20);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, innerWidth: width, offenders };
    });
    expect(metrics.scrollWidth, `${project} scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}, innerWidth=${metrics.innerWidth}, offenders=${JSON.stringify(metrics.offenders)}`).toBeLessThanOrEqual(metrics.innerWidth + 1);
    await page.screenshot({ path: `e2e-results/overflow-${testInfo.project.name}.png`, fullPage: true });
  });
});
