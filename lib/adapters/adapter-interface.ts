/**
 * Adapter Interface
 * Generic interface for CMS adapters to ensure consistent API
 * 
 * This allows the orchestrator to route ChangeIntents to the correct adapter
 * without CMS-specific branching logic.
 */

import type { ChangeIntent } from '@prisma/client'

/**
 * Generic adapter context type
 * Each CMS adapter defines its own context type
 */
export type AdapterContext = 
  | import('./shopifyAdapter').ShopifyAdapterContext
  | import('./wordpressAdapter').WordPressAdapterContext

/**
 * Generic adapter interface
 * All CMS adapters must implement these three methods
 */
export interface CmsAdapter {
  /**
   * Applies a ChangeIntent to the CMS
   * Captures previous values and applies changes
   */
  applyIntent(intent: ChangeIntent, context: AdapterContext): Promise<Record<string, any>>

  /**
   * Verifies that a ChangeIntent was successfully applied
   */
  verifyIntent(intent: ChangeIntent, context: AdapterContext): Promise<boolean>

  /**
   * Rolls back a ChangeIntent by restoring previous values
   */
  rollbackIntent(intent: ChangeIntent, context: AdapterContext): Promise<void>
}

