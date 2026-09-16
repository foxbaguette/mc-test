import { useQuery } from '@tanstack/react-query'

import { readBlogs } from './tables'

export interface Article {
  title: string
  link: string
  author: string
  published: string
  description: string
  thumbnail: string
}

const CACHE_KEY = 'mc_news_home'
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

function readCache(): Article[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { expiry, value } = JSON.parse(raw)
    return Date.now() < expiry ? value : null
  } catch {
    return null
  }
}

/** Latest article per author across the Mission Control blog feeds, newest first. */
async function loadHomeNews(): Promise<Article[]> {
  const cached = readCache()
  if (cached) return cached

  const blogs = await readBlogs()
  const feeds = [...blogs.map((b) => `https://medium.com/feed/${b.blogid}`), 'https://alienw.com/feed']
  const articles = (await Promise.all(feeds.map(readFeed)))
    .flat()
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())

  const seen = new Set<string>()
  const perAuthor = articles.filter((a) => (seen.has(a.author) ? false : (seen.add(a.author), true)))

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ expiry: Date.now() + CACHE_TTL, value: perAuthor }))
  } catch {
    /* storage unavailable */
  }
  return perAuthor
}

export const useHomeNews = () => useQuery({ queryKey: ['homeNews'], queryFn: loadHomeNews, staleTime: CACHE_TTL })

export interface NewsFeed {
  id: string
  name: string
  url: string
}

/** Every Mission Control blog plus Alienw.com, with their articles newest first. */
async function loadNews() {
  const blogs = await readBlogs()
  const feeds: NewsFeed[] = [
    ...blogs.map((blog) => ({ id: blog.blogid, name: blog.blogname, url: `https://medium.com/feed/${blog.blogid}` })),
    { id: 'alien-articles', name: 'Alienw.com', url: 'https://alienw.com/feed' }
  ]

  const lists = await Promise.all(feeds.map((feed) => readFeed(feed.url)))
  const newest = (articles: Article[]) => [...articles].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())

  const byFeed: Record<string, Article[]> = { all: newest(lists.flat()) }
  feeds.forEach((feed, i) => {
    byFeed[feed.id] = newest(lists[i])
  })

  return { feeds, byFeed }
}

export const useNews = () => useQuery({ queryKey: ['news'], queryFn: loadNews, staleTime: CACHE_TTL })
