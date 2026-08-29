import { Helmet } from "react-helmet-async";
import defaultOgImage from "@/assets/projects/gravel-driveway.webp";

const SITE_URL = "https://www.monkeytrucking.llc";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article";
  ogImage?: string;
  ogImageAlt?: string;
  noindex?: boolean;
}

const Seo = ({ title, description, path, jsonLd, ogType = "website", ogImage, ogImageAlt, noindex = false }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  const imagePath = ogImage ?? defaultOgImage;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SITE_URL}${imagePath}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={imageUrl} />
      {ogImageAlt && <meta property="og:image:alt" content={ogImageAlt} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};


export default Seo;
