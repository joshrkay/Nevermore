import type { TableFields } from "@/lib/tableQuery";
import { hasHeld, type TableAddress } from "./address";
import type { useTableRows } from "./useTableRows";

/**
 * Whether the table has nothing to show yet and is waiting for it: no rows have ever arrived (a refresh or the next page keeps the rows
 * on screen and is not loading, D-49), or the address holds something the table can't judge yet, or the person's columns are not known yet
 * (CRM-S3.1a: rows are never drawn in columns the person is about to lose). A failed load is not loading.
 */
export function tableIsLoading<K extends TableFields, Row, Context>(
  address: TableAddress<K>,
  data: ReturnType<typeof useTableRows<K, Row, Context>>,
  waitingForColumns = false,
): boolean {
  return !data.error && (!data.page || hasHeld(address) || waitingForColumns);
}
