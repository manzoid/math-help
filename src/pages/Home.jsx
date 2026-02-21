import { Link } from 'react-router-dom'
import applets from '../applets/registry.js'

const styles = {
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '3rem 1.5rem',
  },
  hero: {
    marginBottom: '3rem',
  },
  title: {
    fontSize: '2.4rem',
    fontWeight: 800,
    marginBottom: '0.5rem',
  },
  description: {
    fontSize: '1.1rem',
    color: 'var(--color-muted)',
    maxWidth: 540,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.2s, transform 0.2s',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    marginBottom: '0.3rem',
  },
  cardSub: {
    fontSize: '0.9rem',
    color: 'var(--color-muted)',
    marginBottom: '0.75rem',
  },
  tags: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: '0.7rem',
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    fontWeight: 500,
  },
}

export default function Home() {
  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <h1 style={styles.title}>Math Help</h1>
        <p style={styles.description}>
          Interactive visualizations that make math click.
        </p>
      </header>

      <div style={styles.grid}>
        {applets.map((applet) => (
          <Link
            key={applet.slug}
            to={`/applets/${applet.slug}`}
            style={styles.card}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={styles.cardTitle}>{applet.title}</div>
            {applet.subtitle && <div style={styles.cardSub}>{applet.subtitle}</div>}
            {applet.tags?.length > 0 && (
              <div style={styles.tags}>
                {applet.tags.map((t) => (
                  <span key={t} style={styles.tag}>{t}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
