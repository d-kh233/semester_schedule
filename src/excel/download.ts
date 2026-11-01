// Скачивание готовой книги Excel в браузере
import type ExcelJS from 'exceljs'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_TYPE }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Даём браузеру начать загрузку, прежде чем отпускать ссылку
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
