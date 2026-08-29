import { useParams, Link, Navigate } from "react-router-dom";
import { Phone, ArrowLeft, ArrowRight } from "lucide-react";
import Seo from "@/components/Seo";
import { POSTS } from "@/content/blog";
import logo from "@/assets/monkey-trucking-logo.webp";

const SITE = "https://www.monkeytrucking.llc";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return <Navigate to="/blog" replace />;

  const idx = POSTS.findIndex((p) => p.slug === post.slug);
  const next = POSTS[(idx + 1) % POSTS.length];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: [`${SITE}${post.cover}`],
    datePublished: post.datePublished,
    dateModified: post.datePublished,
    author: { "@type": "Organization", name: "Monkey Trucking LLC" },
    publisher: {
      "@type": "Organization",
      name: "Monkey Trucking LLC",
      logo: { "@type": "ImageObject", url: `${SITE}${logo}` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/blog/${post.slug}` },
  };

  return (
    <>
      <Seo
        title={post.seoTitle}
        description={post.description}
        path={`/blog/${post.slug}`}
        ogType="article"
        jsonLd={jsonLd}
      />

      <article className="bg-nearblack grain">
        {/* Cover */}
        <header className="relative w-full">
          <div className="relative w-full h-[60svh] min-h-[420px] md:h-[72svh] overflow-hidden">
            <img
              src={post.cover}
              alt={post.coverAlt}
              fetchPriority="high"
              decoding="async"
              width="1600"
              height="1000"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-nearblack/60 to-nearblack/20" />
          </div>

          <div className="max-w-[760px] mx-auto px-5 md:px-8 -mt-32 md:-mt-40 relative z-10 pb-10">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-white/65 hover:text-primary text-xs tracking-[0.22em] uppercase mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> All Field Notes
            </Link>
            <h1
              className="font-heading uppercase text-white red-glow"
              style={{ fontSize: "clamp(36px, 5.6vw, 76px)", lineHeight: 0.98, letterSpacing: "0.01em" }}
            >
              {post.title}
            </h1>
            <div className="mt-6 flex items-center flex-wrap gap-x-4 gap-y-2 text-sm tracking-[0.18em] uppercase text-white/55">
              <span>Monkey Trucking LLC</span>
              <span className="text-primary">·</span>
              <span>Monkey Trucking guide</span>
              <span className="text-primary">·</span>
              <time dateTime={post.datePublished}>{post.dateDisplay}</time>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="max-w-[680px] mx-auto px-5 md:px-8 pb-20">{post.body()}</div>

        {/* CTA band */}
        <section className="border-t border-white/10 bg-[hsl(0_0%_7%)] py-16 md:py-20">
          <div className="max-w-[760px] mx-auto px-5 md:px-8 text-center">
            <h2
              className="font-heading uppercase text-white tracking-wide"
              style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1 }}
            >
              Need gravel, hauling, or dirt work?
            </h2>
            <p className="text-white/70 mt-4 mb-8 text-lg leading-relaxed">
              Call Monkey Trucking or send a quote request with what you need.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <a href="tel:+12146778466" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-primary px-7 font-heading text-lg tracking-wider text-white transition-colors hover:bg-primary/90 sm:w-auto">
                <Phone className="mr-2 h-5 w-5" />
                CALL 214-677-8466
              </a>
              <Link to="/contact" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md border border-white/20 bg-white/5 px-7 font-heading text-lg tracking-wider text-white transition-colors hover:bg-white/10 sm:w-auto">
                GET A QUOTE
              </Link>
            </div>
          </div>
        </section>

        {/* Read next */}
        {next && next.slug !== post.slug && (
          <section className="bg-nearblack grain py-16 border-t border-white/5">
            <div className="max-w-[760px] mx-auto px-5 md:px-8">
              <div className="text-xs tracking-[0.22em] uppercase text-white/45 mb-4">
                Read next
              </div>
              <Link
                to={`/blog/${next.slug}`}
                className="group block relative overflow-hidden rounded-xl hairline"
              >
                <div className="relative aspect-[16/9]">
                  <img
                    src={next.cover}
                    alt={next.coverAlt}
                    loading="lazy"
                    decoding="async"
                    width="1600"
                    height="900"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-nearblack/50 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <h3 className="font-heading uppercase text-white text-2xl sm:text-3xl tracking-wide leading-tight">
                      {next.title}
                    </h3>
                    <div className="mt-3 inline-flex items-center gap-2 text-primary font-heading tracking-wider text-sm uppercase">
                      Continue reading <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}
      </article>
    </>
  );
};

export default BlogPost;
