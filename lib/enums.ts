/**
 * Backend Enums
 * TypeScript enums matching Prisma schema enums
 * Exported for reuse across the backend
 * 
 * These enums match the Prisma schema enums:
 * - ChangeIntentType
 * - ChangeIntentStatus
 */

/**
 * Change Intent Type
 * Types of SEO changes that can be applied to pages
 */
export enum IntentType {
  UPDATE_META = 'UPDATE_META',
  ADD_INTERNAL_LINK = 'ADD_INTERNAL_LINK',
  INJECT_SCHEMA = 'INJECT_SCHEMA',
}

/**
 * Change Intent Status
 * Status of a change intent (pending, applied, failed, or rolled back)
 */
export enum IntentStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

/**
 * Type guard to check if a string is a valid IntentType
 */
export function isIntentType(value: string): value is IntentType {
  return Object.values(IntentType).includes(value as IntentType)
}

/**
 * Type guard to check if a string is a valid IntentStatus
 */
export function isIntentStatus(value: string): value is IntentStatus {
  return Object.values(IntentStatus).includes(value as IntentStatus)
}

