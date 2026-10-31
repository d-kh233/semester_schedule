import { expect, type Page } from '@playwright/test'

// Боковая панель «Список дедлайнов»: открывается кнопкой в верхней панели
export const deadlinesPanel = (page: Page) =>
  page.getByRole('complementary', { name: 'Список дедлайнов' })

export async function openList(page: Page) {
  if (!(await deadlinesPanel(page).isVisible())) {
    await page.getByRole('button', { name: 'Список дедлайнов' }).click()
  }
  await expect(deadlinesPanel(page)).toBeVisible()
}

export async function reloadAndOpenList(page: Page) {
  await page.reload()
  await openList(page)
}

// Окно «Настройки»: семестр, палитра, расписания
export const settingsDialog = (page: Page) => page.getByRole('dialog', { name: 'Настройки' })

export async function openSettings(page: Page) {
  if (!(await settingsDialog(page).isVisible())) {
    await page.getByRole('button', { name: 'Настройки' }).click()
  }
  await expect(settingsDialog(page)).toBeVisible()
}

export async function closeSettings(page: Page) {
  await settingsDialog(page).getByRole('button', { name: 'Закрыть' }).click()
  await expect(settingsDialog(page)).toHaveCount(0)
}
