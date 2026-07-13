import * as XLSX from 'xlsx'

/**
 * Génère et télécharge un fichier .xlsx à partir d'un tableau de lignes.
 * @param {string[]} header - noms des colonnes
 * @param {Array<Array<string|number>>} rows - lignes de données (+ éventuelle ligne de total)
 * @param {string} filename - nom du fichier, sans extension
 * @param {string} sheetName - nom de l'onglet Excel
 */
export function downloadXlsx(header, rows, filename, sheetName = 'Ventes') {
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])

  // Largeur de colonnes raisonnable par défaut
  worksheet['!cols'] = header.map(() => ({ wch: 16 }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
