import JSZip from 'jszip'
import { GPSDataPoint } from '@/types'

export async function parseGPSFile(file: File): Promise<{ data: GPSDataPoint[], fileSize: number }> {
  const fileSize = file.size;

  if (file.name.toLowerCase().endsWith('.zip')) {
    const data = await parseZipFile(file)
    return { data, fileSize }
  } else {
    const content = await file.text()
    const data = parseGPSData(content)
    return { data, fileSize }
  }
}

async function parseZipFile(zipFile: File): Promise<GPSDataPoint[]> {
  const zip = new JSZip()
  const zipData = await zip.loadAsync(zipFile)

  // 获取所有 .map 文件
  const mapFiles: { name: string; content: string; timestamp: number }[] = []

  for (const [filename, file] of Object.entries(zipData.files)) {
    if (filename.toLowerCase().endsWith('.map') && !file.dir) {
      const content = await file.async('text')
      const timestamp = extractTimestampFromFilename(filename)
      mapFiles.push({ name: filename, content, timestamp })
    }
  }

  // 按时间戳排序
  mapFiles.sort((a, b) => a.timestamp - b.timestamp)

  // 解析所有文件内容并合并
  const allData: GPSDataPoint[] = []
  for (const mapFile of mapFiles) {
    const data = parseGPSData(mapFile.content)
    allData.push(...data)
  }

  // 按时间戳再次排序合并后的数据
  allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  return allData
}

function extractTimestampFromFilename(filename: string): number {
  // 文件名格式: 20250722112147_NO_D_000003F.map
  // 提取时间戳: 20250722112147 (YYYYMMDDHHMMSS)
  const timeMatch = filename.match(/(\d{14})/)
  if (timeMatch) {
    const timeStr = timeMatch[1]
    const year = parseInt(timeStr.substring(0, 4))
    const month = parseInt(timeStr.substring(4, 6)) - 1
    const day = parseInt(timeStr.substring(6, 8))
    const hour = parseInt(timeStr.substring(8, 10))
    const minute = parseInt(timeStr.substring(10, 12))
    const second = parseInt(timeStr.substring(12, 14))

    return new Date(year, month, day, hour, minute, second).getTime()
  }

  // 如果无法解析时间戳，使用文件名排序
  return filename.charCodeAt(0)
}

export function parseGPSData(content: string): GPSDataPoint[] {
  const lines = content.trim().split('\n')
  const parsedData: GPSDataPoint[] = []

  for (const line of lines) {
    if (line.trim() === '') continue

    try {
      const cleanLine = line.replace(/;$/, '')
      const parts = cleanLine.split(',')

      if (parts.length < 9) continue

      const [valid, date, time, latStr, latDir, lonStr, lonDir, speed, accX, accY, accZ] = parts

      if (valid !== 'A') continue

      const latitude = convertDDMMToDecimal(latStr, latDir)
      const longitude = convertDDMMToDecimal(lonStr, lonDir)

      const timestamp = parseDateTime(date, time)

      if (!timestamp || isNaN(latitude) || isNaN(longitude)) continue

      parsedData.push({
        valid,
        date,
        time,
        latitude,
        longitude,
        speed: parseFloat(speed) || 0,
        acceleration: {
          x: parseFloat(accX) || 0,
          y: parseFloat(accY) || 0,
          z: parseFloat(accZ) || 0,
        },
        timestamp,
      })
    } catch (error) {
      console.warn('Failed to parse line:', line, error)
    }
  }

  return parsedData
}

function convertDDMMToDecimal(ddmmStr: string, direction: string): number {
  const ddmm = parseFloat(ddmmStr)
  if (isNaN(ddmm)) return NaN

  const degrees = Math.floor(ddmm / 100)
  const minutes = ddmm % 100

  let decimal = degrees + minutes / 60

  if (direction === 'S' || direction === 'W') {
    decimal *= -1
  }

  return decimal
}

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    if (dateStr.length !== 6 || timeStr.length !== 6) return null

    const day = parseInt(dateStr.substring(0, 2))
    const month = parseInt(dateStr.substring(2, 4)) - 1
    const year = 2000 + parseInt(dateStr.substring(4, 6))

    const hour = parseInt(timeStr.substring(0, 2))
    const minute = parseInt(timeStr.substring(2, 4))
    const second = parseInt(timeStr.substring(4, 6))

    const date = new Date(year, month, day, hour, minute, second)

    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}