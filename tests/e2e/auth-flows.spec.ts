import { test, expect, type Page } from '@playwright/test'

const E2E_EMAIL = process.env.E2E_EMAIL
const E2E_PASSWORD = process.env.E2E_PASSWORD

function requireCredentials() {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_EMAIL / E2E_PASSWORD are required')
}

async function login(page: Page) {
    await page.goto('/login')

    if (page.url().endsWith('/today')) return

    await page.locator('input[type="email"]').fill(E2E_EMAIL!)
    await page.locator('input[type="password"]').fill(E2E_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

async function stopFloatingTimerIfPresent(page: Page) {
    const floatingStop = page.locator('button[aria-label="Stop timer"]').first()
    if (await floatingStop.isVisible().catch(() => false)) {
        await floatingStop.click()
        await expect(floatingStop).toBeHidden({ timeout: 10_000 })
    }
}

async function createQuickTask(page: Page, title: string) {
    const mobileQuickAdd = page.getByRole('button', { name: 'Quick add task' })
    const desktopQuickAdd = page.getByRole('button', { name: 'New Task' })

    if (await mobileQuickAdd.isVisible().catch(() => false)) {
        await mobileQuickAdd.click()
    } else {
        await desktopQuickAdd.click()
    }

    await expect(page.getByRole('dialog', { name: 'Quick Capture' })).toBeVisible()
    await page.getByPlaceholder("What's on your mind?").fill(title)
    await page.getByRole('button', { name: 'Save Task' }).click()

    await expect(page.getByRole('dialog', { name: 'Quick Capture' })).toBeHidden({ timeout: 15_000 })
    await page.waitForTimeout(220)
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
}

async function openTaskDetail(page: Page, title: string) {
    const closeTaskDetailButton = page.getByRole('button', { name: 'Close task details' })
    if (!(await closeTaskDetailButton.isVisible().catch(() => false))) {
        await page.getByRole('main').getByText(title, { exact: true }).first().click()
    }
    const dialog = page.locator('[role="dialog"]').filter({ has: page.getByRole('button', { name: 'Close task details' }) }).first()
    await expect(dialog).toBeVisible()
    await expect(closeTaskDetailButton).toBeVisible()
    await expect.poll(async () => {
        const visibleTitleField = dialog.locator('input[aria-label="Task title"]:visible, textarea[placeholder="Task title"]:visible').first()
        if (await visibleTitleField.isVisible().catch(() => false)) {
            return visibleTitleField.inputValue().catch(() => '')
        }
        return ''
    }, { timeout: 10_000 }).toBe(title)
}

async function closeTaskDetailIfOpen(page: Page) {
    const closeTaskDetailButton = page.getByRole('button', { name: 'Close task details' })
    const dialog = page.getByRole('dialog')
    if (await closeTaskDetailButton.isVisible().catch(() => false)) {
        const backdrop = page.locator('div.fixed.inset-0.z-50 > div.absolute.inset-0').first()
        const attemptClose = async () => {
            await closeTaskDetailButton.dispatchEvent('click').catch(() => undefined)
            await closeTaskDetailButton.click({ force: true, timeout: 800 }).catch(() => undefined)
            if (await backdrop.isVisible().catch(() => false)) {
                await backdrop.dispatchEvent('click').catch(() => undefined)
            }
            await page.keyboard.press('Escape').catch(() => undefined)
        }

        await attemptClose()
        try {
            await expect(dialog).toBeHidden({ timeout: 2_500 })
            return
        } catch {
            await attemptClose()
            await expect(dialog).toBeHidden({ timeout: 4_000 })
        }
    }
}

async function deleteCurrentTaskFromDetail(page: Page) {
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Task actions' }).click()
    const deleteTaskMenuButton = page.getByRole('button', { name: 'Delete Task' }).first()
    await expect(deleteTaskMenuButton).toBeVisible({ timeout: 10_000 })
    await deleteTaskMenuButton.click()
    await dismissInstallPromptIfPresent(page)
    await page.getByRole('button', { name: /^Delete task$/i }).click()
    await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function startTimerFromTaskDetail(page: Page, title: string) {
    await openTaskDetail(page, title)
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Start Focus Timer|Switch Focus Timer/i }).click()
    await expect.poll(async () => {
        const floatingStopVisible = await page.locator('button[aria-label="Stop timer"]').first().isVisible().catch(() => false)
        const detailStopVisible = await dialog.getByRole('button', { name: /Stop .*|Stop ·/i }).first().isVisible().catch(() => false)
        return floatingStopVisible || detailStopVisible
    }, { timeout: 10_000 }).toBe(true)
    await closeTaskDetailIfOpen(page)
}

async function stopActiveTimerFromAnySurface(page: Page) {
    const bannerStopTimer = page.getByRole('button', { name: /^Stop Timer$/ }).first()
    if (await bannerStopTimer.isVisible().catch(() => false)) {
        await bannerStopTimer.click()
        await expect(bannerStopTimer).toBeHidden({ timeout: 15_000 })
        return
    }

    const floatingStop = page.locator('button[aria-label="Stop timer"]').first()
    if (await floatingStop.isVisible().catch(() => false)) {
        await floatingStop.click()
        await expect(floatingStop).toBeHidden({ timeout: 15_000 })
    }
}

async function deleteTaskByTitle(page: Page, title: string) {
    await openTaskDetail(page, title)
    await deleteCurrentTaskFromDetail(page)
}

async function openProjectsListView(page: Page) {
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    const listViewButton = page.getByRole('button', { name: 'List View' }).first()
    if (await listViewButton.isVisible().catch(() => false)) {
        await listViewButton.click()
        return
    }
    const listViewTitleButton = page.getByTitle('List View').first()
    if (await listViewTitleButton.isVisible().catch(() => false)) {
        await listViewTitleButton.click()
    }
}

async function dismissInstallPromptIfPresent(page: Page) {
    const installHeading = page.getByRole('heading', { name: 'Install Ghost' })
    if (await installHeading.isVisible().catch(() => false)) {
        const closeButton = page.locator('div.fixed.bottom-6').getByRole('button', { name: 'Close' }).first()
        if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click()
        } else {
            const gotIt = page.getByRole('button', { name: 'Got it' }).first()
            if (await gotIt.isVisible().catch(() => false)) await gotIt.click()
        }
        await expect(installHeading).toBeHidden({ timeout: 10_000 })
    }
}

async function openProjectForm(page: Page) {
    const newProjectButton = page.getByRole('button', { name: /New Project|^New$/i }).first()
    await newProjectButton.click()
    await expect(page.getByRole('heading', { name: 'New Project' })).toBeVisible()
}

async function createProject(page: Page, name: string, options?: { status?: 'backlog' | 'active' | 'completed'; description?: string }) {
    await openProjectForm(page)
    const nameInput = page.getByPlaceholder('e.g. Work, Personal, Fitness')
    await nameInput.fill(name)
    const form = nameInput.locator('xpath=ancestor::form[1]')
    if (options?.description) {
        await form.getByPlaceholder("What's this project about?").fill(options.description)
    }
    if (options?.status && options.status !== 'backlog') {
        await form.locator('select').nth(1).selectOption(options.status)
    }
    await form.getByRole('button', { name: 'Save Project' }).click()
    await expect(page.getByRole('heading', { name: 'New Project' })).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 15_000 })
}

async function openProjectOverlayByName(page: Page, name: string) {
    await dismissInstallPromptIfPresent(page)
    const projectTitle = page.getByRole('main').getByText(name, { exact: true }).first()
    const projectCard = projectTitle.locator('xpath=ancestor::*[./a[starts-with(@href,"/projects/")]][1]')
    const projectLink = projectCard.locator('a[href^="/projects/"]').first()
    await expect(projectLink).toBeVisible({ timeout: 10_000 })
    await projectLink.click({ force: true })
    await expect(page).toHaveURL(/\/projects\/[^/]+(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Close project panel' }).last()).toBeVisible()
}

async function closeProjectOverlay(page: Page) {
    const close = page.getByRole('button', { name: 'Close project panel' }).last()
    if (await close.isVisible().catch(() => false)) {
        await close.click()
        if (!/\/projects(?:\?.*)?$/.test(page.url())) {
            await page.goto('/projects')
        }
        await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
    }
}

async function deleteCurrentProjectFromOverlay(page: Page) {
    await dismissInstallPromptIfPresent(page)
    const actionsButton = page.getByRole('button', { name: 'Project actions' }).last()
    await expect(actionsButton).toBeVisible({ timeout: 10_000 })
    await actionsButton.click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Project' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Delete Project' }).first().click()
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Project?' })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await confirmDialog.getByRole('button', { name: 'Delete Project' }).click()
    await expect(page.getByRole('button', { name: 'Close project panel' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
}

async function deleteProjectByName(page: Page, name: string) {
    await page.goto('/projects')
    await dismissInstallPromptIfPresent(page)
    const projectSearch = page.getByPlaceholder('Search projects')
    if (await projectSearch.isVisible().catch(() => false)) {
        await projectSearch.fill('')
    }
    const statusFilter = page.getByLabel('Filter projects by status')
    if (await statusFilter.isVisible().catch(() => false)) {
        await statusFilter.selectOption('all')
    }
    const match = page.getByRole('main').getByText(name, { exact: true }).first()
    if (!(await match.isVisible().catch(() => false))) return
    await openProjectOverlayByName(page, name)
    await deleteCurrentProjectFromOverlay(page)
    await expect(page.getByRole('main').getByText(name, { exact: true })).toHaveCount(0)
}

async function createTaskFromProjectOverlay(page: Page, title: string) {
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const taskForm = page.getByRole('dialog', { name: 'New Task' })
    await expect(taskForm).toBeVisible()
    await taskForm.getByPlaceholder('What needs to be done?').fill(title)
    await taskForm.getByRole('button', { name: 'Create Task' }).click()
    await expect(taskForm).toBeHidden({ timeout: 15_000 })
    await expect.poll(async () => {
        return page.getByText(title, { exact: true }).count()
    }, { timeout: 30_000 }).toBeGreaterThan(0)
}

async function deleteProjectTaskByTitle(page: Page, title: string) {
    await page.getByText(title, { exact: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await deleteCurrentTaskFromDetail(page)
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
}

test.describe.serial('Authenticated flows', () => {
    test.beforeEach(async ({ page }) => {
        requireCredentials()
        await login(page)
        await stopActiveTimerFromAnySurface(page)
        await stopFloatingTimerIfPresent(page)
        await closeTaskDetailIfOpen(page)
    })

    test('projects route opens detail as true overlay sidebar', async ({ page }) => {
        test.slow()
        const tempProjectName = `E2E Overlay Route ${Date.now()}`
        await page.goto('/projects')
        await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
        try {
            await createProject(page, tempProjectName)
            await openProjectOverlayByName(page, tempProjectName)

            await expect(page).toHaveURL(/\/projects\/[^/]+$/)
            await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible() // background page still mounted
            const closeProjectPanelButton = page.getByRole('button', { name: 'Close project panel' }).last()
            await expect(closeProjectPanelButton).toBeVisible()

            await closeProjectPanelButton.click()
            await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
        } finally {
            await deleteProjectByName(page, tempProjectName)
        }
    })

    test('project overlay closes from backdrop click', async ({ page }) => {
        await page.goto('/projects')
        const projectLinks = page.locator('a[href^="/projects/"]').filter({ hasNot: page.locator('a[href="/projects"]') })
        const count = await projectLinks.count()
        test.skip(count === 0, 'No projects available')

        await projectLinks.first().click()
        await expect(page).toHaveURL(/\/projects\/[^/]+$/)

        await page.getByRole('button', { name: 'Dismiss project panel backdrop' }).click()
        await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
    })

    test('direct project detail link renders and closes back to projects fallback', async ({ page }) => {
        await page.goto('/projects')
        const firstProjectLink = page.locator('a[href^="/projects/"]').filter({ hasNot: page.locator('a[href="/projects"]') }).first()
        test.skip(!(await firstProjectLink.isVisible().catch(() => false)), 'No projects available')
        const href = await firstProjectLink.getAttribute('href')
        test.skip(!href, 'Project link missing href')

        await page.goto(href!)
        await expect(page).toHaveURL(new RegExp(`${href!.replace('/', '\\/')}(?:\\?.*)?$`))
        await page.getByRole('button', { name: 'Close project panel' }).last().click()
        await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
    })

    test('task timer persists after closing task sidebar and floating pill can stop it', async ({ page }) => {
        const title = `E2E Timer ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await openTaskDetail(page, title)

        const dialog = page.getByRole('dialog')
        const startFocusTimerButton = dialog.getByRole('button', { name: /Start Focus Timer|Switch Focus Timer/i })
        await startFocusTimerButton.click()
        await expect.poll(async () => {
            const floatingStopVisible = await page.locator('button[aria-label="Stop timer"]').first().isVisible().catch(() => false)
            const detailStopVisible = await dialog.getByRole('button', { name: /Stop .*|Stop ·/i }).first().isVisible().catch(() => false)
            return floatingStopVisible || detailStopVisible
        }, { timeout: 10_000 }).toBe(true)

        await dialog.getByRole('button', { name: 'Close task details' }).click()
        await expect(dialog).toBeHidden({ timeout: 15_000 })

        const floatingStop = page.locator('button[aria-label="Stop timer"]').first()
        await expect(floatingStop).toBeVisible({ timeout: 10_000 })
        await floatingStop.click()
        await expect(floatingStop).toBeHidden({ timeout: 15_000 })

        await openTaskDetail(page, title)
        await deleteCurrentTaskFromDetail(page)
        await expect(page.getByText(title, { exact: true })).toBeHidden({ timeout: 15_000 })
    })

    test('today active timer banner opens running task and can stop timer', async ({ page }) => {
        const title = `E2E Banner ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await openTaskDetail(page, title)

        const dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: /Start Focus Timer|Switch Focus Timer/i }).click()
        await expect(page.getByText(/Active Timer/i)).toBeVisible({ timeout: 10_000 })

        await closeTaskDetailIfOpen(page)
        await page.getByRole('button', { name: 'Open Task' }).click()
        const reopenedDialog = page.getByRole('dialog')
        await expect(reopenedDialog).toBeVisible()
        await expect(reopenedDialog.getByRole('textbox').first()).toHaveValue(title)

        await closeTaskDetailIfOpen(page)
        const bannerStopTimer = page.getByRole('button', { name: /^Stop Timer$/ }).first()
        await bannerStopTimer.click()
        await expect(bannerStopTimer).toBeHidden({ timeout: 15_000 })

        await openTaskDetail(page, title)
        await deleteCurrentTaskFromDetail(page)
    })

    test('today banner hides after stopping timer from floating pill', async ({ page }) => {
        const title = `E2E BannerHide ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await startTimerFromTaskDetail(page, title)

        await expect(page.getByText(/Active Timer/i)).toBeVisible()
        const floatingStop = page.locator('button[aria-label="Stop timer"]').first()
        await floatingStop.click()
        await expect(floatingStop).toBeHidden({ timeout: 15_000 })
        await expect(page.getByText(/Active Timer/i)).toBeHidden({ timeout: 15_000 })

        await deleteTaskByTitle(page, title)
    })

    test('floating timer pill open button reopens the correct running task', async ({ page }) => {
        const title = `E2E Reopen ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await startTimerFromTaskDetail(page, title)

        const floatingOpen = page.getByRole('button', { name: 'Open running task' })
        await floatingOpen.click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('textbox').first()).toHaveValue(title)

        await closeTaskDetailIfOpen(page)
        await stopActiveTimerFromAnySurface(page)
        await deleteTaskByTitle(page, title)
    })

    test('switching timer between tasks updates global timer surfaces', async ({ page }) => {
        const titleA = `E2E Switch A ${Date.now()}`
        const titleB = `E2E Switch B ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, titleA)
        await createQuickTask(page, titleB)

        await openTaskDetail(page, titleA)
        let dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: /Start Focus Timer|Switch Focus Timer/i }).click()
        await closeTaskDetailIfOpen(page)
        const floatingOpen = page.getByRole('button', { name: 'Open running task' })
        const bannerOpen = page.getByRole('button', { name: 'Open Task' })
        await expect.poll(async () => {
            const a = await floatingOpen.isVisible().catch(() => false)
            const b = await bannerOpen.isVisible().catch(() => false)
            return a || b
        }, { timeout: 10_000 }).toBe(true)
        await expect(bannerOpen).toBeVisible()

        await openTaskDetail(page, titleB)
        dialog = page.getByRole('dialog')
        const switchButtons = dialog.getByRole('button', { name: /Start Focus Timer|Switch Focus Timer|Start Timer|Switch Timer/i })
        await expect(switchButtons.first()).toBeVisible()
        await switchButtons.first().click()
        await closeTaskDetailIfOpen(page)
        await expect.poll(async () => {
            const reopenButton = (await floatingOpen.isVisible().catch(() => false)) ? floatingOpen : bannerOpen
            await reopenButton.click()
            const value = await page.getByRole('dialog').getByRole('textbox').first().inputValue().catch(() => '')
            if (value !== titleB) {
                await closeTaskDetailIfOpen(page)
            }
            return value
        }, { timeout: 12_000 }).toBe(titleB)
        await closeTaskDetailIfOpen(page)
        await expect(page.getByRole('button', { name: 'Open Task' })).toBeVisible()

        const bannerStopTimer = page.getByRole('button', { name: /^Stop Timer$/ }).first()
        await bannerStopTimer.click()
        await expect(bannerStopTimer).toBeHidden({ timeout: 15_000 })

        await openTaskDetail(page, titleA)
        await deleteCurrentTaskFromDetail(page)
        await openTaskDetail(page, titleB)
        await deleteCurrentTaskFromDetail(page)
    })

    test('task detail shows switch focus timer CTA when another task timer is active', async ({ page }) => {
        const titleA = `E2E DetailSwitch A ${Date.now()}`
        const titleB = `E2E DetailSwitch B ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, titleA)
        await createQuickTask(page, titleB)
        await startTimerFromTaskDetail(page, titleA)

        await openTaskDetail(page, titleB)
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByRole('button', { name: /Switch Focus Timer/i })).toBeVisible()
        await closeTaskDetailIfOpen(page)

        await stopActiveTimerFromAnySurface(page)
        await deleteTaskByTitle(page, titleA)
        await deleteTaskByTitle(page, titleB)
    })

    test('task list timer action exposes switch state when another task timer is active', async ({ page }) => {
        const titleA = `E2E ListSwitch A ${Date.now()}`
        const titleB = `E2E ListSwitch B ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, titleA)
        await createQuickTask(page, titleB)
        await startTimerFromTaskDetail(page, titleA)

        const taskRowB = page.getByRole('main').getByText(titleB, { exact: true }).locator('xpath=ancestor::div[contains(@class,"group relative")]').first()
        const switchTimerButton = taskRowB.getByRole('button', { name: /Switch active timer to this task|Switch focus timer for task/i })
        await expect(switchTimerButton).toBeVisible()

        await stopActiveTimerFromAnySurface(page)
        await deleteTaskByTitle(page, titleA)
        await deleteTaskByTitle(page, titleB)
    })

    test('quick capture can be closed with cancel without creating a task', async ({ page }) => {
        const title = `E2E Cancel ${Date.now()}`
        await page.goto('/today')
        const mobileQuickAdd = page.getByRole('button', { name: 'Quick add task' })
        const desktopQuickAdd = page.getByRole('button', { name: 'New Task' })
        if (await mobileQuickAdd.isVisible().catch(() => false)) await mobileQuickAdd.click()
        else await desktopQuickAdd.click()

        const quickCapture = page.getByRole('dialog', { name: 'Quick Capture' })
        await expect(quickCapture).toBeVisible()
        await page.getByPlaceholder("What's on your mind?").fill(title)
        await page.getByRole('button', { name: 'Cancel' }).click()
        await expect(quickCapture).toBeHidden({ timeout: 15_000 })
        await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    })

    test('quick capture can be dismissed with escape on desktop', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop-only')
        await page.goto('/today')
        await page.getByRole('button', { name: 'New Task' }).click()
        const quickCapture = page.getByRole('dialog', { name: 'Quick Capture' })
        await expect(quickCapture).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(quickCapture).toBeHidden({ timeout: 15_000 })
    })

    test('today active timer banner open task button appears only while timer is active', async ({ page }) => {
        const title = `E2E BannerBtn ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await expect(page.getByRole('button', { name: 'Open Task' })).toHaveCount(0)

        await startTimerFromTaskDetail(page, title)
        await expect(page.getByRole('button', { name: 'Open Task' })).toBeVisible()

        await stopActiveTimerFromAnySurface(page)
        await expect(page.getByRole('button', { name: 'Open Task' })).toHaveCount(0)

        await deleteTaskByTitle(page, title)
    })

    test('floating timer pill survives navigation between today and projects', async ({ page }) => {
        const title = `E2E NavPill ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await startTimerFromTaskDetail(page, title)

        await page.goto('/projects')
        await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

        await page.goto('/today')
        await expect.poll(async () => {
            const pillVisible = await page.locator('button[aria-label="Stop timer"]').first().isVisible().catch(() => false)
            const bannerVisible = await page.getByText(/Active Timer/i).isVisible().catch(() => false)
            return pillVisible || bannerVisible
        }, { timeout: 10_000 }).toBe(true)

        await stopActiveTimerFromAnySurface(page)
        await deleteTaskByTitle(page, title)
    })

    test('iPhone task sheet shows mobile quick actions', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile-only validation')

        const title = `E2E Mobile ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await openTaskDetail(page, title)

        const dialog = page.getByRole('dialog')
        await expect(dialog.getByRole('button', { name: /Start Timer|Switch Timer/i })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Log Time' })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Close task details' })).toBeVisible()

        // Quick sanity check for the mobile sticky header + grab-handle treatment.
        await expect(dialog.locator('header')).toBeVisible()
        await expect(dialog.locator('header').locator('div[aria-hidden="true"]')).toBeVisible()

        await deleteCurrentTaskFromDetail(page)
    })

    test('iPhone task sheet mobile quick timer button starts and stops timer', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile-only validation')

        const title = `E2E MobileTimer ${Date.now()}`
        await page.goto('/today')
        await createQuickTask(page, title)
        await openTaskDetail(page, title)

        const dialog = page.getByRole('dialog')
        const mobileQuickTimerButton = dialog.getByRole('button', { name: /Start Timer|Switch Timer/i })
        await mobileQuickTimerButton.click()
        await expect(dialog.getByRole('button', { name: /Stop Focus Timer|Switch Focus Timer|Stop .*|Stop ·/i })).toBeVisible({ timeout: 10_000 })

        await closeTaskDetailIfOpen(page)
        await expect(page.locator('button[aria-label="Stop timer"]').first()).toBeVisible()
        await stopActiveTimerFromAnySurface(page)
        await deleteTaskByTitle(page, title)
    })

    test('project form can be dismissed by backdrop click without creating a project', async ({ page }) => {
        const name = `E2E Project Cancel ${Date.now()}`
        await page.goto('/projects')
        await openProjectForm(page)
        await page.getByPlaceholder('e.g. Work, Personal, Fitness').fill(name)
        await page.getByRole('button', { name: 'Dismiss project form backdrop' }).dispatchEvent('click')
        await expect(page.getByRole('heading', { name: 'New Project' })).toBeHidden({ timeout: 15_000 })
        await expect(page.getByRole('main').getByText(name, { exact: true })).toHaveCount(0)
    })

    test('project form save button is disabled until name is provided', async ({ page }) => {
        await page.goto('/projects')
        await openProjectForm(page)
        const saveButton = page.getByRole('button', { name: 'Save Project' })
        await expect(saveButton).toBeDisabled()
        await page.getByPlaceholder('e.g. Work, Personal, Fitness').fill(`E2E Project Enable ${Date.now()}`)
        await expect(saveButton).toBeEnabled()
        await page.getByRole('button', { name: 'Dismiss project form backdrop' }).dispatchEvent('click')
        await expect(page.getByRole('heading', { name: 'New Project' })).toBeHidden({ timeout: 15_000 })
    })

    test('created project appears in list and opens as overlay', async ({ page }) => {
        test.slow()
        const name = `E2E Project Open ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, name)
            await openProjectOverlayByName(page, name)
            await expect(page.locator('h1').filter({ hasText: name })).toBeVisible()
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, name)
        }
    })

    test('project search isolates matches and clears back to full list', async ({ page }) => {
        test.slow()
        const nameA = `E2E Search Alpha ${Date.now()}`
        const nameB = `E2E Search Beta ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, nameA)
            await createProject(page, nameB)

            const search = page.getByPlaceholder('Search projects')
            await search.fill('Alpha')
            await expect(page.getByRole('main').getByText(nameA, { exact: true })).toBeVisible()
            await expect(page.getByRole('main').getByText(nameB, { exact: true })).toHaveCount(0)

            await search.fill('')
            await expect(page.getByRole('main').getByText(nameA, { exact: true })).toBeVisible()
            await expect(page.getByRole('main').getByText(nameB, { exact: true })).toBeVisible()
        } finally {
            await page.getByPlaceholder('Search projects').fill('')
            await deleteProjectByName(page, nameA)
            await deleteProjectByName(page, nameB)
        }
    })

    test('project status filter isolates completed projects', async ({ page }) => {
        test.slow()
        const backlogName = `E2E Backlog ${Date.now()}`
        const completedName = `E2E Completed ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, backlogName, { status: 'backlog' })
            await createProject(page, completedName, { status: 'completed' })

            const statusFilter = page.getByLabel('Filter projects by status')
            if (!(await statusFilter.isVisible().catch(() => false))) {
                const mobileFiltersToggle = page.locator('button[aria-expanded]').filter({ hasText: 'Filters' }).first()
                if (await mobileFiltersToggle.isVisible().catch(() => false)) {
                    await mobileFiltersToggle.click()
                }
            }
            await page.getByLabel('Filter projects by status').selectOption('completed')
            await expect(page.getByRole('main').getByText(completedName, { exact: true })).toBeVisible()
            await expect(page.getByRole('main').getByText(backlogName, { exact: true })).toHaveCount(0)
        } finally {
            await deleteProjectByName(page, backlogName)
            await deleteProjectByName(page, completedName)
        }
    })

    test('projects list and grid view toggles still allow opening overlay', async ({ page }) => {
        test.slow()
        const name = `E2E View Toggle ${Date.now()}`
        await page.goto('/projects')
        try {
            await createProject(page, name)

            await openProjectsListView(page)
            await openProjectOverlayByName(page, name)
            await closeProjectOverlay(page)

            const gridViewButton = page.getByRole('button', { name: 'Grid View' }).first()
            if (await gridViewButton.isVisible().catch(() => false)) {
                await gridViewButton.click()
            } else {
                const gridTitleButton = page.getByTitle('Grid View').first()
                if (await gridTitleButton.isVisible().catch(() => false)) await gridTitleButton.click()
            }

            await openProjectOverlayByName(page, name)
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, name)
        }
    })

    test('browser back closes project overlay route to projects list', async ({ page }) => {
        test.slow()
        const name = `E2E Back Nav ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, name)
            await openProjectOverlayByName(page, name)
            await page.goBack()
            await expect(page).toHaveURL(/\/projects(?:\?.*)?$/)
            await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
            await expect(page.getByRole('button', { name: 'Close project panel' })).toHaveCount(0)
        } finally {
            await deleteProjectByName(page, name)
        }
    })

    test('project inline title rename persists after closing and reopening overlay', async ({ page }) => {
        test.slow()
        const name = `E2E Rename ${Date.now()}`
        const renamed = `${name} Updated`
        await openProjectsListView(page)
        try {
            await createProject(page, name)
            await openProjectOverlayByName(page, name)

            await page.locator('h1').filter({ hasText: name }).click()
            const titleInput = page.locator('header input').first()
            await expect(titleInput).toBeVisible()
            await titleInput.fill(renamed)
            await titleInput.blur()
            await expect(page.getByRole('heading', { name: renamed })).toBeVisible({ timeout: 15_000 })

            await closeProjectOverlay(page)
            await openProjectOverlayByName(page, renamed)
            await expect(page.locator('h1').filter({ hasText: renamed })).toBeVisible()
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, renamed)
            await deleteProjectByName(page, name)
        }
    })

    test('project overlay can add a task and open its task detail', async ({ page }) => {
        test.slow()
        test.fixme(true, 'ProjectDetail task list does not reliably reflect newly created tasks immediately in overlay route')
        const projectName = `E2E Project Task ${Date.now()}`
        const taskTitle = `E2E Project Task Item ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, projectName)
            await openProjectOverlayByName(page, projectName)
            await createTaskFromProjectOverlay(page, taskTitle)
            await page.getByText(taskTitle, { exact: true }).first().click()
            await expect(page.getByRole('dialog')).toBeVisible()
            await expect(page.getByRole('button', { name: 'Close task details' })).toBeVisible()
            await closeTaskDetailIfOpen(page)
            await deleteProjectTaskByTitle(page, taskTitle)
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, projectName)
        }
    })

    test('project task filters switch between done and todo states', async ({ page }) => {
        test.slow()
        test.fixme(true, 'Depends on project overlay task list reflecting newly created tasks immediately')
        const projectName = `E2E Project Filters ${Date.now()}`
        const taskTitle = `E2E Project Filter Task ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, projectName)
            await openProjectOverlayByName(page, projectName)
            await createTaskFromProjectOverlay(page, taskTitle)

            const taskRow = page.getByText(taskTitle, { exact: true }).locator('xpath=ancestor::div[contains(@class,"group relative")]').first()
            await taskRow.getByRole('button', { name: 'Mark task as completed' }).click()
            await expect(taskRow.getByRole('button', { name: 'Mark task as not completed' })).toBeVisible({ timeout: 10_000 })

            await page.getByRole('button', { name: 'Done' }).click()
            await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()
            await page.getByRole('button', { name: 'To-Do' }).click()
            await expect(page.getByText(taskTitle, { exact: true })).toHaveCount(0)
            await page.getByRole('button', { name: 'All' }).click()
            await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()

            await deleteProjectTaskByTitle(page, taskTitle)
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, projectName)
        }
    })

    test('project Add Task modal can be cancelled without creating a task', async ({ page }) => {
        test.slow()
        const projectName = `E2E Project CancelTask ${Date.now()}`
        const taskTitle = `E2E Cancelled Project Task ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, projectName)
            await openProjectOverlayByName(page, projectName)
            await page.getByRole('button', { name: 'Add Task', exact: true }).click()
            const taskForm = page.getByRole('dialog', { name: 'New Task' })
            await expect(taskForm).toBeVisible()
            await taskForm.getByPlaceholder('What needs to be done?').fill(taskTitle)
            await taskForm.getByRole('button', { name: 'Cancel' }).click()
            await expect(taskForm).toBeHidden({ timeout: 15_000 })
            await expect(page.getByText(taskTitle, { exact: true })).toHaveCount(0)
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, projectName)
        }
    })

    test('project overlay task can start timer and closing project still keeps floating timer pill', async ({ page }) => {
        test.slow()
        test.fixme(true, 'Depends on project overlay task list reflecting newly created tasks immediately')
        const projectName = `E2E Project Timer ${Date.now()}`
        const taskTitle = `E2E Project Timer Task ${Date.now()}`
        await openProjectsListView(page)
        try {
            await createProject(page, projectName)
            await openProjectOverlayByName(page, projectName)
            await createTaskFromProjectOverlay(page, taskTitle)
            await startTimerFromTaskDetail(page, taskTitle)
            await closeProjectOverlay(page)
            await expect(page.locator('button[aria-label="Stop timer"]').first()).toBeVisible()
            await stopActiveTimerFromAnySurface(page)

            await openProjectOverlayByName(page, projectName)
            await deleteProjectTaskByTitle(page, taskTitle)
            await closeProjectOverlay(page)
        } finally {
            await deleteProjectByName(page, projectName)
        }
    })
})
