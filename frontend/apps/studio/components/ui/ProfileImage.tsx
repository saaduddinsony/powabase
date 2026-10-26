import { User } from 'icons'
import Image from 'next/image'
import { ReactNode, useState } from 'react'
import { cn } from 'ui'

interface ProfileImageProps {
  alt?: string
  src?: string
  placeholder?: ReactNode
  className?: string
}

export const ProfileImage = ({ alt, src, placeholder, className }: ProfileImageProps) => {
  const [hasInvalidImg, setHasInvalidImg] = useState(false)

  return !!src && !hasInvalidImg ? (
    <Image
      alt={alt ?? ''}
      src={src}
      width="24"
      height="24"
      className={cn('aspect-square bg-surface-200 dark:bg-surface-300 rounded-full object-cover border border-default', className)}
      onError={() => setHasInvalidImg(true)}
    />
  ) : (
    (placeholder ?? (
      <figure
        className={cn(
          'bg-surface-200 hover:bg-surface-300 dark:bg-surface-300 rounded-full flex items-center justify-center border border-default transition-colors text-foreground',
          className
        )}
      >
        <User size={16} strokeWidth={1.5} className="text-foreground" />
      </figure>
    ))
  )
}
