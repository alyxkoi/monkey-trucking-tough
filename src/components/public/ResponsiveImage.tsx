import type { ImgHTMLAttributes } from "react";

type ResponsiveImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  mobileSrc?: string;
};

/**
 * Keeps the approved image treatment while allowing phones to download a
 * right-sized asset. The original image remains the tablet/desktop source.
 */
export default function ResponsiveImage({ mobileSrc, alt = "", ...imageProps }: ResponsiveImageProps) {
  return (
    <picture>
      {mobileSrc && <source media="(max-width: 767px)" srcSet={mobileSrc} />}
      <img alt={alt} {...imageProps} />
    </picture>
  );
}
