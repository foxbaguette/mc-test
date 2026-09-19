import './PageHeader.css'

interface PageHeaderProps {
  title: string
  image: string
}

/** Artwork banner that opens every in-app page. */
export function PageHeader({ title, image }: PageHeaderProps) {
  return (
    <header className="page-header">
      <img className="page-header__img" src={image} alt="" />
      <div className="page-header__inner">
        <h1 className="page-header__title">{title}</h1>
      </div>
    </header>
  )
}
