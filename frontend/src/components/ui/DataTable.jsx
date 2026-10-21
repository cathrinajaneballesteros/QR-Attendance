import React from 'react';

export default function DataTable({
  columns = [],
  children,
  className = '',
  style = {}
}) {
  return (
    <div className={`sres-table-wrap ${className}`} style={style}>
      <table className="sres-table">
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  style={col.width ? { width: col.width } : (col.align ? { textAlign: col.align } : {})}
                >
                  {col.label || col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}
