import React from 'react';

export default function PageTitle({ 
  title, 
  emoji, 
  tag, 
  icon: TagIcon, 
  action, 
  children 
}) {
  return (
    <div className="sres-page-header">
      <div className="sres-page-title-wrap">
        <h1 className="sres-page-heading">
          <span>{title}</span>
          {emoji && <span className="sres-page-emoji">{emoji}</span>}
        </h1>

        {tag && (
          <div className="sres-page-pill-tag">
            {TagIcon && <TagIcon size={13} strokeWidth={2} />}
            <span>{tag}</span>
          </div>
        )}

        {children}
      </div>

      {action && (
        <div className="sres-page-header-action">
          {action}
        </div>
      )}
    </div>
  );
}
