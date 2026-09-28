import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  /** Property of the row to render, or a render function. */
  key: string;
  header: ReactNode;
  /** Custom cell renderer. Defaults to `row[key]`. */
  render?: (row: T) => ReactNode;
  /** Optional column width, applied as a style. */
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Stable key for each row. Defaults to the row index. */
  rowKey?: (row: T, index: number) => string | number;
  /** Rendered when there are no rows. */
  emptyState?: ReactNode;
  className?: string;
}

/**
 * A simple styled HTML table. `columns` describe headers and cell rendering;
 * `rows` provide the data.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  className,
}: DataTableProps<T>): JSX.Element {
  return (
    <div className={className}>
      <table className="farm-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyState ?? "No data"}</td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = rowKey ? rowKey(row, index) : index;
              return (
                <tr key={key}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
