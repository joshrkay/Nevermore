import { useEffect, type ReactNode } from "react";
import type { TableFields } from "@/lib/tableQuery";
import type { TableAddress } from "./address";
import { TABLE_PAGE_SIZE, type TableDefinition } from "./columns";
import { DataTable } from "./DataTable";
import { Pager } from "./Pager";
import type { useTableAddress } from "./useTableAddress";
import type { useTableRows } from "./useTableRows";

interface Props<K extends TableFields, Row> {
  table: TableDefinition<K, Row>;
  location: ReturnType<typeof useTableAddress<K, Row>>;
  data: ReturnType<typeof useTableRows<K, Row>>;
  /** Names the table to a screen reader. */
  caption: string;
  /** Above the table: the search box and the controls that change the address. CRM-S3.3a's filter row and CRM-S3.1a's columns menu join here. */
  toolbar?: ReactNode;
  /** The tabs over the table: the queue's status tabs now, CRM-S3.4a's saved views later. */
  views?: ReactNode;
  /** CRM-S3.6 (D-47): the bar that appears when rows are selected goes here. Nothing selects rows yet. */
  // selection?: ReactNode;
  /** What shows before the first rows arrive. CRM-S2.1 fills it with grey rows shaped like the columns. */
  loading: ReactNode;
  /** What shows when nothing matches (nothing yet, or nothing matches the filters). CRM-S2.2 fills it. */
  empty: (address: TableAddress<K>) => ReactNode;
  /** What shows when the rows can't be loaded, with the way to try again. CRM-S2.3 fills it. */
  error: (error: Error, retry: () => void, address: TableAddress<K>) => ReactNode;
  /** A click anywhere on a row, outside its links, opens it. */
  onOpenRow?: (row: Row) => void;
}

/**
 * The frame every workspace table sits in (CRM-S3.5a): the toolbar and views above, then whichever of loading, error, empty or the table
 * with its pager the data calls for. A page past the end is corrected to the last page (the address is rewritten, not left lying).
 */
export function TableFrame<K extends TableFields, Row>({ table, location, data, caption, toolbar, views, loading, empty, error, onOpenRow }: Props<K, Row>) {
  const { address, hrefFor, change } = location;
  const { page } = data;
  const pageSize = page?.pageSize ?? TABLE_PAGE_SIZE;
  const lastPage = page ? Math.max(1, Math.ceil(page.total / pageSize)) : 1;
  // An address names a page the table doesn't have (a bookmark of a longer list): go to the last one.
  const pastTheEnd = !!page && !data.isPlaceholder && address.page > lastPage;
  useEffect(() => {
    if (pastTheEnd) change({ page: lastPage }, { replace: true });
  }, [pastTheEnd, lastPage, change]);

  return (
    <div>
      {toolbar}
      {views}
      {data.error ? (
        error(data.error, data.retry, address)
      ) : !page || pastTheEnd ? (
        loading
      ) : page.rows.length === 0 ? (
        empty(address)
      ) : (
        <>
          <DataTable table={table} rows={page.rows} caption={caption} sort={address.sort} busy={data.isPlaceholder} onOpenRow={onOpenRow} />
          <Pager page={page.page} at={address.page} total={page.total} pageSize={pageSize} hrefFor={(p) => hrefFor({ page: p })} />
        </>
      )}
    </div>
  );
}
