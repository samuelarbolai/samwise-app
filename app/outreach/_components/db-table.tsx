import type { ReactNode } from "react";

export interface DbTableColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
}

interface DbTableProps<T> {
  columns: DbTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedId?: string;
  emptyMessage?: string;
}

export function DbTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  selectedId,
  emptyMessage = "no entries.",
}: DbTableProps<T>) {
  if (rows.length === 0) {
    return <p className="db-table__empty">{emptyMessage}</p>;
  }
  return (
    <div className="db-table__wrap">
      <table className="db-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align ?? "left",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const selected = id === selectedId;
            const rowClass = selected
              ? "db-table__row db-table__row--selected"
              : "db-table__row";
            return (
              <tr
                key={id}
                className={rowClass}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? "left" }}>
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, ReactNode>)[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
