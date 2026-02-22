import { test, expect } from '@playwright/test'

test.describe('Ghost public smoke', () => {
    test('login page renders core controls', async ({ page }) => {
        await page.goto('/login')

        await expect(page.getByRole('heading', { name: 'Ghost' })).toBeVisible()
        await expect(page.locator('input[type="email"]')).toBeVisible()
        await expect(page.locator('input[type="password"]')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible()
    })

    test('protected route redirects unauthenticated users to login', async ({ page }) => {
        await page.goto('/today')

        await expect(page).toHaveURL(/\/login$/)
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    })

    test('forgot-password view toggles and returns to sign in', async ({ page }) => {
        await page.goto('/login')

        await page.getByRole('button', { name: 'Forgot password?' }).click()
        await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()

        await page.getByRole('button', { name: 'Back to sign in' }).click()
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    })
})
