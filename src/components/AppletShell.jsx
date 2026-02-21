import { Link } from 'react-router-dom'

const styles = {
  wrapper: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  backLink: {
    display: 'inline-block',
    fontSize: '0.85rem',
    marginBottom: '1.5rem',
    color: 'var(--color-muted)',
  },
  header: {
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    marginBottom: '0.3rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: 'var(--color-muted)',
    marginBottom: '0.75rem',
  },
  tags: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: '0.75rem',
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    fontWeight: 500,
  },
}

export default function AppletShell({ title, subtitle, tags, children }) {
  return (
    <div style={styles.wrapper}>
      <Link to="/" style={styles.backLink}>
        &larr; All applets
      </Link>
      <header style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        {tags?.length > 0 && (
          <div style={styles.tags}>
            {tags.map((t) => (
              <span key={t} style={styles.tag}>{t}</span>
            ))}
          </div>
        )}
      </header>
      {children}
    </div>
  )
}
