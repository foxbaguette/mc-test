import { useHomeNews } from '@/data/news'
import { formatDate } from '@/lib/time'

export function News() {
  const { data, isLoading } = useHomeNews()

  return (
    <section className="menu-section">
      <h2 className="section-title">LATEST NEWS</h2>
      <div className="news">
        {isLoading
          ? [0, 1, 2].map((i) => <div key={i} className="skeleton news__loading" />)
          : data?.slice(0, 3).map((article) => (
              <a key={article.link} className="news__card" href={article.link} target="_blank" rel="noreferrer">
                <div className="news__media">
                  <img src={article.thumbnail} alt="" loading="lazy" />
                </div>
                <div className="news__body">
                  <p className="news__meta muted">
                    {formatDate(new Date(article.published))} · {article.author}
                  </p>
                  <h3 className="news__title">{article.title}</h3>
                  <p className="news__desc">{article.description}</p>
                  <span className="news__link">Read on Medium →</span>
                </div>
              </a>
            ))}
      </div>
    </section>
  )
}
