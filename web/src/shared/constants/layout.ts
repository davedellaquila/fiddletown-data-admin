/**
 * Layout Constants
 * 
 * Defines consistent positioning values for sticky table headers across different modules.
 * These offsets ensure table headers align properly below toolbars when scrolling.
 * 
 * Values are calculated based on toolbar height + padding for each module.
 * 
 * @module layout
 */

/**
 * Sticky header top offset values for each module
 * 
 * These values position table headers below their respective toolbars.
 * Each module has different toolbar heights, so offsets vary accordingly.
 * 
 * @property LOCATIONS - Offset for Locations module table header (125px)
 * @property EVENTS - Offset for Events module table header (176px - taller toolbar)
 * @property ROUTES - Offset for Routes module table header (125px)
 */
export const STICKY_HEADER_TOP_OFFSETS = {
  LOCATIONS: '125px', // 125px - 20px (padding)
  EVENTS: '176px',
  ROUTES: '125px'
} as const;
