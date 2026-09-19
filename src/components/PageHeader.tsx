import './PageHeader.css'

interface PageHeaderProps {
  title: string
  image: string
  /** e.g. page-header--compact: a slim banner on phones, for screens played like a game. */
  className?: string
}

/** Artwork banner that opens every in-app page. */
export function PageHeader({ title, image, className = '' }: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`}>
      <img className="page-header__img" src={image} alt="" />
      <div className="page-header__inner">
        <h1 className="page-header__title">{title}</h1>
      </div>
    </header>
  )
}
