export const DEFAULT_MENU_IMAGE =
  "https://res.cloudinary.com/dsllwmcoq/image/upload/v1784136756/fallback_menu_xgttlt.webp"

export function getMenuImageSrc(image?: string | null) {
  const src = typeof image === "string" ? image.trim() : ""
  return src || DEFAULT_MENU_IMAGE
}

export function setFallbackMenuImage(image: HTMLImageElement) {
  if (image.src !== DEFAULT_MENU_IMAGE) {
    image.src = DEFAULT_MENU_IMAGE
  }
}
