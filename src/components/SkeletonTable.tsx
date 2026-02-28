interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable = ({ rows = 5, columns = 6 }: SkeletonTableProps) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`skeleton-row-${rowIndex}`} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-4 py-3">
              <div className="h-4 w-full rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
