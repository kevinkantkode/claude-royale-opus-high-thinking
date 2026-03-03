import { useState } from 'react'
import type { Card } from './types'
import { getCardImageUrl } from './cardImages'

interface CardDisplayProps {
  card: Card | null | undefined
  variant: 'base' | 'ability'
  className?: string
}

export function CardDisplay({ card, variant, className }: CardDisplayProps) {
  const [imgError, setImgError] = useState(false)

  if (!card) return null

  const imgUrl = getCardImageUrl(card.key, variant)

  if (imgError) {
    return <span className={`card-name ${className ?? ''}`}>{card.name}</span>
  }

  return (
    <img
      src={imgUrl}
      alt={card.name}
      title={card.name}
      className={`card-image ${className ?? ''}`}
      onError={() => setImgError(true)}
    />
  )
}
