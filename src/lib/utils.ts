import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatTimestamp(ms?: number | null): string {
  if (!ms || Number.isNaN(ms)) return "-"

  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function formatSpeed(speed?: number | null): string {
  if (speed === undefined || speed === null || Number.isNaN(speed)) return "-"

  return `${speed.toFixed(2)} km/h`
}

export function formatDuration(start?: number | null, end?: number | null): string {
  if (
    start === undefined ||
    start === null ||
    end === undefined ||
    end === null ||
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    return "-"
  }

  const diff = Math.max(0, end - start)
  const totalSeconds = Math.floor(diff / 1000)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ]

  return parts.join(":")
}
