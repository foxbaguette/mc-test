import { useState, type ImgHTMLAttributes } from 'react'

import { AW_IMAGE_URL, DEFAULT_AVATAR } from '@/chain/config'
import { publicUrl } from '@/lib/publicUrl'

const PUBLIC_PINATA = 'https://gateway.pinata.cloud'

interface IpfsImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** IPFS hash, optionally with a path ("Qm…/file.jpeg"). */
  hash?: string | null
  fallback?: string
}

/**
 * IPFS images are served from the site (/ipfs/<hash>, filled by
 * scripts/fetch-ipfs.mjs). Anything added on chain since the last fetch falls
 * back to remote gateways, then to the default avatar. The old dedicated
 * Pinata gateway refuses most hashes, so the public ones are used instead.
 */
export function IpfsImg({ hash, fallback = DEFAULT_AVATAR, loading = 'lazy', ...rest }: IpfsImgProps) {
  const clean = hash && hash !== '-' ? hash.trim() : ''
  const sources = clean
    ? [publicUrl(`/ipfs/${clean}`), `${AW_IMAGE_URL}/ipfs/${clean}`, `${PUBLIC_PINATA}/ipfs/${clean}`, fallback]
    : [fallback]
  // Which source failed is remembered per hash: a new image starts again at the local copy.
  const [failed, setFailed] = useState({ hash: clean, index: 0 })
  const index = failed.hash === clean ? failed.index : 0

  return (
    <img
      {...rest}
      loading={loading}
      src={sources[Math.min(index, sources.length - 1)]}
      onError={() => setFailed({ hash: clean, index: Math.min(index + 1, sources.length - 1) })}
    />
  )
}
