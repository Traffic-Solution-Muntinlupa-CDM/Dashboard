export function Card({ children, className = '' }) {
  return <section className={`atlas-panel ${className}`}>{children}</section>;
}

export function SectionHeading({ title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, description, badge }) {
  return (
    <div className="page-title">
      <div className="title-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {badge}
    </div>
  );
}
