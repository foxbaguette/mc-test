import { useQuery } from '@tanstack/react-query'

import { readBlogs } from './tables'
import { newsKeys } from './keys'

export interface Article {
  title: string
  link: string
  author: string
  published: string
  description: string
  thumbnail: string
}

const CACHE_KEY = 'mc_news'
/** Where the home page kept its own copy before both pages shared one. */
const OLD_CACHE_KEY = 'mc_news_home'
const CACHE_TTL = 4 * 60 * 60 * 1000

// Public RSS-to-JSON converter. (The old site's Vercel fallback now answers 402.)
const converters = [(feed: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`]

interface FeedItem {
  title?: string
  link?: string
  author?: string
  pubDate?: string
  published?: string | number
  content?: string
  description?: string
  thumbnail?: string
  enclosure?: { thumbnail?: string; link?: string }
}

function toArticle(item: FeedItem, feedTitle: string, feedImage: string): Article {
  const html = item.content || item.description || ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return {
    title: String(item.title ?? '').replace(/&amp;/g, '&'),
    link: item.link ?? '',
    author: item.author || feedTitle,
    published: String(item.pubDate ?? item.published ?? ''),
    description: doc.querySelector('p')?.textContent ?? '',
    thumbnail: doc.querySelector('img')?.getAttribute('src') || item.thumbnail || item.enclosure?.thumbnail || feedImage
  }
}

async function readFeed(feed: string): Promise<Article[]> {
  for (const convert of converters) {
    try {
      const res = await fetch(convert(feed))
      if (!res.ok) continue
      const json = await res.json()
      const items: FeedItem[] = json.items ?? []
      const title = json.feed?.title ?? json.title ?? ''
      const image = json.feed?.image ?? json.image ?? ''
      if (items.length) return items.map((item) => toArticle(item, title, image))
    } catch {
      /* try the next converter */
    }
  }
  return []
}

export interface NewsFeed {
  id: string
  name: string
  url: string
}

export interface News {
  feeds: NewsFeed[]
  /** Articles per feed id, newest first; `all` holds every feed together. */
  byFeed: Record<string, Article[]>
}

function readCache(): News | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { expiry, value } = JSON.parse(raw)
    return Date.now() < expiry && value?.byFeed ? value : null
  } catch {
    return null
  }
}

function writeCache(value: News) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ expiry: Date.now() + CACHE_TTL, value }))
    localStorage.removeItem(OLD_CACHE_KEY)
  } catch {
    /* storage unavailable */
  }
}

const newest = (articles: Article[]) =>
  [...articles].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())

/**
 * Every Mission Control blog plus Alienw.com, with their articles newest first. One download
 * serves both the News page and the home page, and is kept in the browser for four hours.
 */
async function loadNews(): Promise<News> {
  const cached = readCache()
  if (cached) return cached

  const blogs = await readBlogs()
  const feeds: NewsFeed[] = [
    ...blogs.map((blog) => ({ id: blog.blogid, name: blog.blogname, url: `https://medium.com/feed/${blog.blogid}` })),
    { id: 'alien-articles', name: 'Alienw.com', url: 'https://alienw.com/feed' }
  ]

  const lists = await Promise.all(feeds.map((feed) => readFeed(feed.url)))
  const byFeed: Record<string, Article[]> = { all: newest(lists.flat()) }
  feeds.forEach((feed, i) => {
    byFeed[feed.id] = newest(lists[i])
  })

  const news = { feeds, byFeed }
  // Nothing came back (the converter was down): don't keep that for four hours.
  if (byFeed.all.length > 0) writeCache(news)
  return news
}

export const useNews = () => useQuery({ queryKey: newsKeys.all, queryFn: loadNews, staleTime: CACHE_TTL })

/** The newest article of each author, for the home page. */
export function latestPerAuthor(news: News): Article[] {
  const seen = new Set<string>()
  return news.byFeed.all.filter((article) => (seen.has(article.author) ? false : (seen.add(article.author), true)))
}

/** Same query and cache as the News page, reduced to the latest article per author. */
export const useHomeNews = () =>
  useQuery({ queryKey: newsKeys.all, queryFn: loadNews, staleTime: CACHE_TTL, select: latestPerAuthor })
