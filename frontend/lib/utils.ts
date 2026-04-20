import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'text-green-600 bg-green-50'
    case 'PROCESSING':
      return 'text-blue-600 bg-blue-50'
    case 'PENDING':
      return 'text-yellow-600 bg-yellow-50'
    case 'FAILED':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function getGradeColor(percentage: number): string {
  if (percentage >= 90) return 'text-green-600'
  if (percentage >= 75) return 'text-blue-600'
  if (percentage >= 60) return 'text-yellow-600'
  return 'text-red-600'
}
