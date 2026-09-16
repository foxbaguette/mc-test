import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'
import { Select } from '@/components/Select'
import { useNews } from '@/data/news'
import { formatDate } from '@/lib/time'
import { publicUrl } from '@/lib/publicUrl'

import './News.css'

const ALL = 'all'
const ALIEN = 'alien-articles'

export default function News() {
  const { data, isLoading } = useNews()
  const [feedId, setFeedId] = useState(ALL)

  const options = useMemo(
    () => [{ value: ALL, label: 'All' }, ...(data?.feeds ?? []).map((feed) => ({ value: feed.id, label: feed.name }))],
    [data?.feeds]
  )

  const articles = data?.byFeed[feedId] ?? []
  const feedName = options.find((option) => option.value === feedId)?.label ?? ''
  const onAlienw = feedId === ALIEN
  const source = onAlienw ? 'Alienw.com' : 'Medium'
  const sourceLink = onAlienw ? 'https://alienw.com/' : `https://medium.com/${feedId === ALL ? 'mining-matters' : feedId}`

  return (
    <>
      <PageHeader title="News" image={publicUrl('/assets/background/bg-news.jpeg')} />

      <div className="page feed">
        <div className="feed__bar">
          <Select value={feedId} options={options} onChange={setFeedId} ariaLabel="Blog" />
        </div>

        <div className="feed__list">
          {isLoading ? (
            Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton feed__skeleton" />)
          ) : articles.length === 0 ? (
            <p className="feed__empty">No news</p>
          ) : (
            articles.map((article) => (
              <article key={article.link} className="feed__item">
                <figure className="feed__media">
                  {article.thumbnail && <img src={article.thumbnail} alt="" loading="lazy" />}
                </figure>
                <div className="feed__body">
                  <p className="feed__date num">{formatDate(new Date(article.published))}</p>
                  <h2 className="feed__title">{article.title}</h2>
                  <p className="feed__desc">{article.description}</p>
                  <a href={article.link} target="_blank" rel="noreferrer" className="feed__read">
                    <Button asSpan size="sm" color="gradientPink">
                      Read on {source}
                    </Button>
                  </a>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="feed__footer">
          <p>Want to read older articles of {feedId === ALL ? 'Mission Control' : feedName}?</p>
          <a href={sourceLink} target="_blank" rel="noreferrer">
            <Button asSpan color="gradientBlue">
              Go to {source}
            </Button>
          </a>
        </footer>
      </div>
    </>
  )
}
