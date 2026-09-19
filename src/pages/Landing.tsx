import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DISCORD_URL } from '@/chain/config'
import { Button } from '@/components/Button'
import { toast } from '@/components/toast'
import { useSession } from '@/state/session'
import { formatTransactError, preloadWallet } from '@/wallet/session'
import { publicUrl } from '@/lib/publicUrl'

import './Landing.css'

const tutorials = [
  {
    title: 'Adventures',
    img: publicUrl('/assets/highlight/tutorial1.jpeg'),
    href: 'https://medium.com/mining-matters/feature-spotlight-adventures-c28fb9fff6e2'
  },
  {
    title: 'Rewards',
    img: publicUrl('/assets/highlight/tutorial2.jpeg'),
    href: 'https://medium.com/mining-matters/feature-spotlight-reward-points-and-weekly-rewards-8d47daeef693'
  },
  {
    title: 'Questing',
    img: publicUrl('/assets/highlight/tutorial3.jpeg'),
    href: 'https://medium.com/mining-matters/feature-spotlight-voting-db0d7d9354e6'
  }
]

export default function Landing() {
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // The bar sits clear over the hero and turns solid once the page moves.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sections rise into place as they scroll into view.
  useEffect(() => {
    const items = root.current?.querySelectorAll('[data-reveal]') ?? []
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  async function handleLogin() {
    setBusy(true)
    try {
      if (await login()) navigate(`/${params.get('redirect') ?? 'menu'}`, { replace: true })
    } catch (err) {
      toast.error(formatTransactError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing" ref={root}>
      <header className={`landing__header ${scrolled ? 'is-scrolled' : ''}`}>
        <a className="landing__brand" href={import.meta.env.BASE_URL} aria-label="Mission Control">
          <img src={publicUrl('/assets/icons/mission-control.png')} alt="" />
          <span>HOME</span>
        </a>
        <Button
          onClick={handleLogin}
          onPointerEnter={preloadWallet}
          onFocus={preloadWallet}
          isLoading={busy}
          disabled={busy}
          className="landing__nav-cta btn--plate"
        >
          PLAY
        </Button>
      </header>

      <main>
        <section className="landing__hero">
          <img className="landing__hero-bg" src={publicUrl('/assets/background/bg-landing.webp')} alt="" />
          <div className="landing__hero-content">
            <img className="landing__hero-logo" src={publicUrl('/assets/icons/mission-control.png')} alt="" />
            <h1>Mission Control</h1>
            <p>Games and Quests in the Alien Worlds Metaverse</p>
            <Button
              size="lg"
              onClick={handleLogin}
              onPointerEnter={preloadWallet}
              onFocus={preloadWallet}
              isLoading={busy}
              disabled={busy}
              className="landing__hero-cta btn--charged"
            >
              PLAY
            </Button>
          </div>
          <span className="landing__scroll" aria-hidden />
        </section>

        <section className="landing__section">
          <div className="landing__split" data-reveal>
            <div className="landing__copy">
              <span className="landing__accent" aria-hidden />
              <h2>Play, Discover, Expand</h2>
              <p>
                Begin your journey as a miner, discover the metaverse and choose your path: Become an adventurer, builder or
                politician.
              </p>
              <p>Together, the community shapes the future of Alien Worlds.</p>
            </div>
            <figure className="landing__frame">
              <img src={publicUrl('/assets/highlight/img1.jpeg')} alt="" loading="lazy" />
            </figure>
          </div>
        </section>

        <section className="landing__section landing__section--dark">
          <div className="landing__split landing__split--reverse" data-reveal>
            <div className="landing__mosaic">
              <figure className="landing__frame">
                <img src={publicUrl('/assets/highlight/img2.jpeg')} alt="" loading="lazy" />
              </figure>
              <figure className="landing__frame">
                <img src={publicUrl('/assets/highlight/img3.jpeg')} alt="" loading="lazy" />
              </figure>
              <figure className="landing__frame">
                <img src={publicUrl('/assets/highlight/img4.jpeg')} alt="" loading="lazy" />
              </figure>
            </div>
            <div className="landing__copy">
              <span className="landing__accent" aria-hidden />
              <h2>What is Mission Control?</h2>
              <p>Mission Control is a community built expansion to the Alien Worlds Metaverse.</p>
              <p>Use your Alien Worlds NFTs, win some TLM, join our community and just have fun.</p>
              <p>Mission Control offers games, tools, lore and more.</p>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="landing__discord">
                <Button asSpan color="ghost" className="btn--plate">
                  JOIN DISCORD
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="landing__section landing__section--cards">
          <div className="landing__cards" data-reveal>
            {tutorials.map((item) => (
              <a className="landing__card" key={item.title} href={item.href} target="_blank" rel="noreferrer">
                <img src={item.img} alt="" loading="lazy" />
                <div className="landing__card-body">
                  <h3>{item.title}</h3>
                  <span className="landing__card-cta">READ ON MEDIUM →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <a className="landing__brand" href={import.meta.env.BASE_URL} aria-label="Mission Control">
          <img src={publicUrl('/assets/icons/mission-control.png')} alt="" />
          <span>HOME</span>
        </a>
      </footer>
    </div>
  )
}
