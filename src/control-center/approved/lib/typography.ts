/**
 * Shared type treatments that are not components.
 *
 * A person's or a company's name is what gets scanned for down a list, so it
 * carries more weight and a slightly larger size than the need, the description
 * and the metadata around it. Weight and size do that job cleanly. Anton stays
 * reserved for numbers, dates and short statements.
 */
export const RECORD_NAME = 'font-control-body font-bold leading-tight text-ink'

/** Name at list row size. */
export const RECORD_NAME_ROW = `${RECORD_NAME} text-[17px]`

/** Name at drill down title size. */
export const RECORD_NAME_LG = `${RECORD_NAME} text-[20px]`
